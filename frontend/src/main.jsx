
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { rulesData, categoriesData, officialRulesTable } from "./rulesData";
import "./styles.css";

import { isOnline, saveScanOffline, syncOfflineScans, getOfflineQueue, clearOfflineQueue, base64ToBlob, API_BASE_URL } from './offlineSync';


import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { TextRecognition } from "@capacitor-mlkit/text-recognition";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";


/**
 * Dot-Matrix Preprocessing for CIJ-Printed Package Labels
 * 
 * Factory Continuous Inkjet (CIJ) printers produce characters as grids of
 * disconnected pin-dots (typically 5x7 or 7x9 dot matrices). Google ML Kit's
 * text detector is trained on continuous-stroke fonts and drops these pin-dot
 * patterns as background halftone noise.
 * 
 * This preprocessing bridges the gaps between pin-dots using Canvas pixel
 * manipulation, making the text detectable by standard OCR engines.
 * 
 * Pipeline: Grayscale → Threshold → Dilation (3x3, 2 passes) → Invert
 */

/** Load an image URL onto a canvas and return the canvas + context. */
function loadImageToCanvas(imgSrc) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve({ canvas, ctx, width: canvas.width, height: canvas.height });
    };
    img.onerror = reject;
    img.src = imgSrc;
  });
}

/** Apply dot-matrix bridging preprocessing to a canvas in-place. */
function preprocessDotMatrix(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const len = width * height;

  // Step 1: Grayscale + Binary Threshold (Otsu-approximated fixed threshold)
  // Pin-dot ink is dark (< 140), background is light (> 180)
  const gray = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Compute Otsu threshold
  const histogram = new Uint32Array(256);
  for (let i = 0; i < len; i++) histogram[gray[i]]++;
  let total = len, sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumB = 0, wB = 0, maxVariance = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) { maxVariance = variance; threshold = t; }
  }

  // Binary: 1 = ink (dark), 0 = background (light)
  const binary = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    binary[i] = gray[i] < threshold ? 1 : 0;
  }

  // Step 2: Dilation with 3x3 kernel (2 passes to bridge dot gaps)
  // This is the morphological CLOSE equivalent: dilate dark pixels
  for (let pass = 0; pass < 2; pass++) {
    const dilated = new Uint8Array(len);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let found = false;
        for (let dy = -1; dy <= 1 && !found; dy++) {
          for (let dx = -1; dx <= 1 && !found; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              if (binary[ny * width + nx] === 1) found = true;
            }
          }
        }
        dilated[y * width + x] = found ? 1 : 0;
      }
    }
    dilated.forEach((v, i) => { binary[i] = v; });
  }

  // Step 3: Write back as black-on-white image
  for (let i = 0; i < len; i++) {
    const val = binary[i] === 1 ? 0 : 255; // ink=black, bg=white
    data[i * 4] = val;
    data[i * 4 + 1] = val;
    data[i * 4 + 2] = val;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Save a canvas as a JPEG file and return the native file path for ML Kit. */
async function saveCanvasAsFile(canvas) {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const base64Data = dataUrl.split(",")[1];
  const fileName = `preprocessed_${Date.now()}.jpg`;
  const result = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Cache,
  });
  return result.uri;
}

/** Check if two bounding boxes overlap significantly (IoU > 0.3). */
function bboxOverlaps(a, b) {
  const [ax1, ay1, ax2, ay2] = a;
  const [bx1, by1, bx2, by2] = b;
  const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
  if (ix2 <= ix1 || iy2 <= iy1) return false;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const aArea = (ax2 - ax1) * (ay2 - ay1);
  const bArea = (bx2 - bx1) * (by2 - by1);
  const union = aArea + bArea - inter;
  return union > 0 && (inter / union) > 0.3;
}

/** Merge items from original ML Kit pass and preprocessed ML Kit pass.
 *  For duplicates (overlapping bboxes), keep the original (better bbox accuracy).
 *  For items only in preprocessed pass, add them (ML Kit missed them in original). */
function mergeOcrPasses(originalItems, preprocessedItems) {
  const merged = [...originalItems];
  for (const ppItem of preprocessedItems) {
    const isDuplicate = originalItems.some(orig =>
      bboxOverlaps(orig.bbox, ppItem.bbox)
    );
    if (!isDuplicate) {
      // This item was detected ONLY in the preprocessed image
      // Mark it so we can track provenance
      merged.push({ ...ppItem, _fromPreprocessed: true });
    }
  }
  return merged;
}


function extractRawOcrBoxes(response) {
  const items = response.ocr?.items;
  if (!items || !Array.isArray(items)) return [];

  const source_width = response.ocr?.source_width || response.width;
  const source_height = response.ocr?.source_height || response.height;

  if (!source_width || !source_height) return [];

  return items.map(item => {
    if (item.bbox && item.bbox.length === 4) {
      const [left, top, right, bottom] = item.bbox;
      return {
        id: Math.random().toString(36).substr(2, 9),
        text: item.text,
        box: {
          x: (left / source_width) * 100,
          y: (top / source_height) * 100,
          w: ((right - left) / source_width) * 100,
          h: ((bottom - top) / source_height) * 100,
        }
      };
    }
    return null;
  }).filter(Boolean);
}

function mapBackendResponseToChecks(response) {
  const findings = response.compliance?.findings;
  if (!findings || !Array.isArray(findings)) return [];

  const source_width = response.ocr?.source_width || response.width;
  const source_height = response.ocr?.source_height || response.height;

  return findings.map((item, index) => {
    let frontendStatus = "review";
    const beStatus = (item.status || "").toUpperCase();
    if (beStatus === "COMPLIANT") frontendStatus = "verified";
    else if (beStatus === "VIOLATION" || beStatus === "NON_COMPLIANT") frontendStatus = "violation";
    else if (beStatus === "MANUAL_REVIEW_REQUIRED" || beStatus === "NOT_APPLICABLE") frontendStatus = "review";

    const evidenceItem = item.evidence && item.evidence[0] ? item.evidence[0].source_evidence : null;
    let box = { x: 0, y: 0, w: 0, h: 0 };
    let confidence = 0;
    let evidenceText = "";

    if (evidenceItem) {
      const { text, confidence: conf, bbox } = evidenceItem;
      evidenceText = text;
      confidence = Math.round(conf * 100 * 10) / 10;
      if (bbox && source_width && source_height && bbox.length === 4) {
        const [left, top, right, bottom] = bbox;
        box = {
          x: (left / source_width) * 100,
          y: (top / source_height) * 100,
          w: ((right - left) / source_width) * 100,
          h: ((bottom - top) / source_height) * 100,
        };
      }
    }

    let displayValue = evidenceText || "No evidence";
    let displayLabel = item.rule_id;

    if (item.evidence && item.evidence[0]) {
      const ev = item.evidence[0];
      if (ev.value !== undefined && ev.value !== null) {
        displayValue = String(ev.value) + (ev.unit ? " " + ev.unit : "");
      }
      if (ev.field_name) {
        displayLabel = ev.field_name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }

    return {
      id: item.rule_id || `rule-${index}`,
      label: displayLabel,
      value: displayValue,
      rule: item.rule_id,
      shortRule: item.legal_reference || item.rule_id,
      confidence: confidence,
      status: frontendStatus,
      backendStatus: item.status,
      evidence: evidenceText || "No evidence text",
      box: box,
      requirement: item.message,
      decision: item.status,
    };
  });
}

function Icon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    camera: <><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-1.5-2Z" /><circle cx="12" cy="12" r="3.5" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="M10.3 3.7 2.1 18a2 2 0 0 0 1.7 3h16.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-14.5-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 14.5 4.9L20 16" /><path d="M20 20v-4h-4" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    book: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></>,
    scale: <><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
    maximize: <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>,
    minimize: <><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></>,
    expand: <><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function App() {
  const [screen, setScreen] = useState("scan");
  const [image, setImage] = useState(null);

  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  
  
  useEffect(() => {
     loadQueueCount();
     
     let networkListener;
     if (window.Capacitor && window.Capacitor.isNativePlatform()) {
         Network.addListener('networkStatusChange', status => {
             if (status.connected) {
                 syncOfflineScans().then(() => loadQueueCount());
             }
         }).then(l => networkListener = l);
     }

     return () => { 
         if (networkListener) networkListener.remove(); 
     };
  }, []);


  const [isSyncing, setIsSyncing] = useState(false);

  const loadQueueCount = async () => {
     const q = await getOfflineQueue();
     setOfflineQueueCount(q.length);
  };

  const handleSync = async () => {
     if (isSyncing) return;
     setIsSyncing(true);
     try {
         const success = await syncOfflineScans();
         const q = await getOfflineQueue();
         setOfflineQueueCount(q.length);
         if (success && q.length === 0) {
             alert("Sync complete! All offline scans uploaded successfully.");
         } else if (success && q.length > 0) {
             alert(`Sync completed with ${q.length} scan(s) remaining in queue.`);
         } else {
             alert("Device is offline or server unreachable. Connect and try again.");
         }
     } catch (err) {
         console.error("Sync error:", err);
         alert("Sync error: " + (err?.message || err));
     } finally {
         setIsSyncing(false);
         loadQueueCount();
     }
  };

  const [checks, setChecks] = useState([]);
  const [rawOcrBoxes, setRawOcrBoxes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [currentScanId, setCurrentScanId] = useState(null);
  const [currentScanData, setCurrentScanData] = useState(null);
  const [isDecidingResult, setIsDecidingResult] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (screen === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [screen]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        stopCamera();
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        processFile(file);
      }
    }, "image/jpeg", 0.9);
  };

  const selectedCheck = checks.find(c => c.id === selected) || checks[0];
  const verified = checks.filter(c => c.status === "verified").length;
  const review = checks.filter(c => c.status === "review").length;
  const violations = checks.filter(c => c.status === "violation").length;

  const steps = [
    ["Image received", "Package image loaded successfully"],
    ["Image quality check", "Checking sharpness, glare and readability"],
    ["OCR scanning", "Detecting text and bounding boxes"],
    ["Extracting declarations", "Mapping package text to structured fields"],
    ["Checking Legal Metrology rules", "Evaluating declarations against rules"],
    ["Generating compliance report", "Preparing explainable findings"],
  ];

  
  const processNativeFile = async (image) => {
    setImage(image.webPath);
    setScreen("processing");
    setPipelineStep(0);
    setError(null);

    let step = 0;
    const progressTimer = setInterval(() => {
      step++;
      if (step < steps.length - 1) {
        setPipelineStep(step);
      }
    }, 1000);

    let edgePayload = null;

    try {
        // ============================================================
        // PASS 1: Run ML Kit on ORIGINAL camera image
        // ============================================================
        const mlkitResult = await TextRecognition.processImage({
            path: image.path
        });

        let source_width = 1920;
        let source_height = 1080;
        try {
          const imgObj = new Image();
          await new Promise((resolve) => {
            imgObj.onload = resolve;
            imgObj.onerror = resolve;
            imgObj.src = image.webPath;
          });
          source_width = imgObj.naturalWidth || 1920;
          source_height = imgObj.naturalHeight || 1080;
        } catch (e) {
          console.warn("Could not read image dimensions:", e);
        }

        /** Extract items from an ML Kit result */
        const extractItems = (result) => {
            const extracted = [];
            (result.blocks || []).forEach(b => {
                if (b.lines && b.lines.length > 0) {
                    b.lines.forEach(line => {
                        let { left, top, right, bottom } = line.boundingBox || { left: 0, top: 0, right: 10, bottom: 10 };
                        if (right <= left) right = left + 10;
                        if (bottom <= top) bottom = top + 10;
                        const elements = (line.elements || []).map(elem => {
                            let eb = elem.boundingBox || { left: 0, top: 0, right: 10, bottom: 10 };
                            let eLeft = eb.left || 0;
                            let eTop = eb.top || 0;
                            let eRight = eb.right || (eLeft + 10);
                            let eBottom = eb.bottom || (eTop + 10);
                            if (eRight <= eLeft) eRight = eLeft + 10;
                            if (eBottom <= eTop) eBottom = eTop + 10;
                            return {
                                text: elem.text || "",
                                confidence: 0.95,
                                bbox: [eLeft, eTop, eRight, eBottom]
                            };
                        });
                        extracted.push({
                            text: line.text || "",
                            confidence: 0.95,
                            bbox: [left, top, right, bottom],
                            elements
                        });
                    });
                } else {
                    let { left, top, right, bottom } = b.boundingBox || { left: 0, top: 0, right: 10, bottom: 10 };
                    if (right <= left) right = left + 10;
                    if (bottom <= top) bottom = top + 10;
                    extracted.push({
                        text: b.text || "",
                        confidence: 0.95,
                        bbox: [left, top, right, bottom],
                        elements: []
                    });
                }
            });
            return extracted;
        };

        const originalItems = extractItems(mlkitResult);
        console.log(`[DualPass] Pass 1 (original): ${originalItems.length} items detected`);

        // ============================================================
        // PASS 2: Dot-Matrix Preprocessing + ML Kit re-scan
        // Bridges disconnected CIJ pin-dots into solid strokes
        // ============================================================
        let items = originalItems;
        try {
          const { canvas, ctx, width, height } = await loadImageToCanvas(image.webPath);
          preprocessDotMatrix(ctx, width, height);
          const preprocessedPath = await saveCanvasAsFile(canvas);
          console.log(`[DualPass] Preprocessed image saved to: ${preprocessedPath}`);

          const mlkitResult2 = await TextRecognition.processImage({
            path: preprocessedPath
          });
          const preprocessedItems = extractItems(mlkitResult2);
          console.log(`[DualPass] Pass 2 (preprocessed): ${preprocessedItems.length} items detected`);

          // Merge: keep original items (better bboxes), add NEW items from preprocessed
          items = mergeOcrPasses(originalItems, preprocessedItems);
          const newCount = items.length - originalItems.length;
          console.log(`[DualPass] Merged: ${items.length} total items (${newCount} NEW from preprocessing)`);

          // Cleanup temp file
          try { await Filesystem.deleteFile({ path: preprocessedPath }); } catch (_) {}
        } catch (ppErr) {
          console.warn("[DualPass] Preprocessing pass failed (using original only):", ppErr);
          items = originalItems;
        }

        edgePayload = {
             engine: Capacitor.getPlatform() === 'ios' ? 'apple_vision' : 'google_mlkit',
             source_width,
             source_height,
             items
        };

        if (!(await isOnline())) {
            await saveScanOffline(image.webPath, edgePayload, image.path);
            setError("Saved offline! Scan queued for sync when connected.");
            clearInterval(progressTimer);
            loadQueueCount();
            return;
        }

        const edgeResponse = await fetch(`${API_BASE_URL}/api/scans/edge`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(edgePayload)
        });

        if (!edgeResponse.ok) throw new Error("Edge OCR server error (" + edgeResponse.status + ")");
        let data = await edgeResponse.json();

        if (data.status === "pending_fallback") {
            let blob = null;
            try {
                const res = await fetch(image.webPath);
                blob = await res.blob();
            } catch (fetchErr) {
                if (image.path && window.Capacitor && window.Capacitor.isNativePlatform()) {
                    try {
                        const fileData = await Filesystem.readFile({ path: image.path });
                        if (fileData?.data) {
                            blob = base64ToBlob(fileData.data, 'image/jpeg');
                        }
                    } catch (_) {}
                }
            }
            if (!blob) throw new Error("Could not load image for fallback processing");

            const formData = new FormData();
            formData.append("image", blob, "fallback.jpg");
            
            const fallbackResponse = await fetch(`${API_BASE_URL}/api/scans/${data.scan_id}/fallback`, {
                method: 'POST',
                body: formData
            });
            if (!fallbackResponse.ok) throw new Error("Fallback processing failed (" + fallbackResponse.status + ")");
            data = await fallbackResponse.json();
        }

        clearInterval(progressTimer);
        setCurrentScanId(data.scan_id);
        setCurrentScanData(data);
        const newChecks = mapBackendResponseToChecks(data);
        const newRawOcrBoxes = extractRawOcrBoxes(data);
        setChecks(newChecks);
        setRawOcrBoxes(newRawOcrBoxes);
        setPipelineStep(steps.length - 1);

        if (newChecks.length > 0) {
          setSelected(newChecks[0].id);
        }

        setTimeout(() => setScreen("result"), 600);
    } catch(err) {
        clearInterval(progressTimer);
        console.error("Native processing error:", err);
        const errMsg = String(err?.message || err);
        if (edgePayload && (errMsg.includes("connect") || errMsg.includes("fetch") || errMsg.includes("Failed to connect") || errMsg.includes("NetworkError") || errMsg.includes("unable to connect"))) {
            try {
                await saveScanOffline(image.webPath, edgePayload, image.path);
                setError("Backend unreachable (" + errMsg + "). Scan saved to Offline Queue! Tap sync when connected.");
                loadQueueCount();
                return;
            } catch (offlineErr) {
                console.error("Offline save also failed:", offlineErr);
            }
        }
        setError("Edge processing failed: " + errMsg);
    }
  };

  const handleGallery = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await Camera.getPhoto({
          quality: 100,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos
        });
        await processNativeFile(image);
      } catch (e) {
        console.error(e);
      }
    } else {
      fileRef.current?.click();
    }
  };

  const handleCamera = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await Camera.getPhoto({
          quality: 100,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera
        });
        await processNativeFile(image);
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        setScreen("camera");
      } catch (err) {
        alert("Camera access denied or unavailable. You can still use the gallery upload.");
      }
    }
  };

  const processFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    setScreen("processing");
    setPipelineStep(0);
    setError(null);

    let step = 0;
    const progressTimer = setInterval(() => {
      step++;
      if (step < steps.length - 1) {
        setPipelineStep(step);
      }
    }, 1000);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`${API_BASE_URL}/api/scans`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressTimer);

      if (!response.ok) {
        throw new Error("Failed to process image.");
      }

      const data = await response.json();
      setCurrentScanId(data.scan_id);
      setCurrentScanData(data);
      const newChecks = mapBackendResponseToChecks(data);
      const newRawOcrBoxes = extractRawOcrBoxes(data);

      setChecks(newChecks);
      setRawOcrBoxes(newRawOcrBoxes);
      setPipelineStep(steps.length - 1);

      if (newChecks.length > 0) {
        setSelected(newChecks[0].id);
      }

      setTimeout(() => setScreen("result"), 800);

    } catch (err) {
      clearInterval(progressTimer);
      setError(err.message);
      // Wait for user to manually reset rather than auto-resetting
    }
  };

  useEffect(() => () => image && URL.revokeObjectURL(image), [image]);

  const onFile = e => processFile(e.target.files?.[0]);
  const openCamera = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      // Mobile browsers have excellent native camera integration via input capture.
      cameraRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScreen("camera");
    } catch (err) {
      alert("Camera access denied or unavailable.");
      cameraRef.current?.click(); // Fallback to native input if permissions blocked or unsupported
    }
  };

  const reset = () => {
    stopCamera();
    setScreen("scan");
    setImage(null);
    setChecks([]);
    setRawOcrBoxes([]);
    setSelected(null);
    setError(null);
    setPipelineStep(0);
    setCurrentScanId(null);
    setCurrentScanData(null);
    setIsDecidingResult(false);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const loadScanDetail = async (scanId) => {
    try {
      setScreen("processing");
      setPipelineStep(steps.length - 1);
      const res = await fetch(`${API_BASE_URL}/api/scans/${scanId}`);
      if (!res.ok) throw new Error("Could not load scan (" + res.status + ")");
      const data = await res.json();
      setCurrentScanId(scanId);
      setCurrentScanData(data);
      const newChecks = mapBackendResponseToChecks(data);
      const newRawOcrBoxes = extractRawOcrBoxes(data);
      setChecks(newChecks);
      setRawOcrBoxes(newRawOcrBoxes);
      const ext = data.filename && data.filename.includes('.') ? data.filename.split('.').pop() : 'jpg';
      setImage(`${API_BASE_URL}/data/scans/${scanId}.${ext}`);
      if (newChecks.length > 0) {
        setSelected(newChecks[0].id);
      }
      setScreen("result");
    } catch (err) {
      console.error("Failed to load historical scan:", err);
      setError("Failed to load historical scan: " + err.message);
      setScreen("history");
    }
  };

  const handleResultDecision = async (decision) => {
    if (!currentScanId) return;
    const confirmMsg = decision === "compliant"
      ? "Confirm this package is fully COMPLIANT with Legal Metrology (Packaged Commodities) Rules, 2011?"
      : "Confirm this package is in VIOLATION of Legal Metrology (Packaged Commodities) Rules, 2011?";
    if (!window.confirm(confirmMsg)) return;

    setIsDecidingResult(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/scans/${currentScanId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decision,
          officer_id: "OFFICER-DEFAULT",
          notes: `Confirmed ${decision} by officer in audit review`,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to submit decision");
      }
      const updatedData = await res.json();
      setCurrentScanData(updatedData);
      const newChecks = mapBackendResponseToChecks(updatedData);
      setChecks(newChecks);
    } catch (err) {
      console.error("Result decision error:", err);
      alert(`Decision Error: ${err.message}`);
    } finally {
      setIsDecidingResult(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const verifiedCount = checks.filter(c => c.status === "verified").length;
      const reviewCount = checks.filter(c => c.status === "review").length;
      const violationCount = checks.filter(c => c.status === "violation").length;
      const isCompliant = reviewCount === 0 && violationCount === 0;

      const hasInspectorDecision = Boolean(currentScanData?.inspector_decision);
      const isConfirmedCompliant = currentScanData?.inspector_decision?.decision === "compliant";
      const isConfirmedViolation = currentScanData?.inspector_decision?.decision === "violation" || violationCount > 0;

      const reportHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Legal Metrology Inspection Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0f172a; max-width: 800px; margin: 0 auto; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
    .sub { font-size: 12px; color: #475569; margin-top: 2px; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 4px; font-weight: 800; font-size: 13px; text-transform: uppercase; }
    .compliant { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .review { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .violation { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; font-size: 13px; }
    th { background: #f8fafc; font-weight: 700; color: #334155; }
    .status-verified { color: #16a34a; font-weight: 700; }
    .status-review { color: #d97706; font-weight: 700; }
    .status-violation { color: #dc2626; font-weight: 700; }
    .footer { margin-top: 30px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">METRICHECK · LEGAL METROLOGY COMPLIANCE AUDIT</div>
      <div class="sub">Packaged Commodities Rules, 2011 Inspection Record</div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #64748b;">
      <div>Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}</div>
      <div>Station: Default Inspection Unit</div>
    </div>
  </div>

  <div style="background: ${isConfirmedViolation ? '#fee2e2' : isCompliant || isConfirmedCompliant ? '#f0fdf4' : '#fffbeb'}; border: 2px solid ${isConfirmedViolation ? '#ef4444' : isCompliant || isConfirmedCompliant ? '#22c55e' : '#f59e0b'}; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <div style="font-size: 11px; color: ${isConfirmedViolation ? '#991b1b' : isCompliant || isConfirmedCompliant ? '#166534' : '#92400e'}; font-weight: 800; text-transform: uppercase;">
      Official Officer Enforcement Determination
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
      <div class="badge ${isConfirmedViolation ? 'violation' : isCompliant || isConfirmedCompliant ? 'compliant' : 'review'}">
        ${hasInspectorDecision ? (isConfirmedCompliant ? '✓ OFFICER CONFIRMED COMPLIANT' : '✗ OFFICER CONFIRMED VIOLATION') : (isCompliant ? '✓ AUTOMATICALLY COMPLIANT' : '! MANUAL REVIEW REQUIRED')}
      </div>
      <div style="font-size: 13px; font-weight: 600; color: #334155;">
        ${verifiedCount} Verified · ${reviewCount} Review · ${violationCount} Violations
      </div>
    </div>
    ${hasInspectorDecision ? `
      <div style="font-size: 12px; color: #475569; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
        <strong>Adjudicating Officer:</strong> ${currentScanData.inspector_decision.officer_id || 'OFFICER-DEFAULT'} · 
        <strong>Timestamp:</strong> ${new Date(currentScanData.inspector_decision.decided_at).toLocaleString('en-IN')}
        ${currentScanData.inspector_decision.notes ? `<br><strong>Officer Findings / Notes:</strong> ${currentScanData.inspector_decision.notes}` : ''}
      </div>
    ` : ''}
  </div>

  <h3 style="font-size: 14px; text-transform: uppercase; color: #334155; margin-bottom: 8px;">Evaluated Declarations (Rule 6(1))</h3>
  <table>
    <thead>
      <tr>
        <th>Declaration Item</th>
        <th>Legal Reference</th>
        <th>Extracted Value / Evidence</th>
        <th>Confidence</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>
      ${checks.map(c => `
        <tr>
          <td><strong>${c.label}</strong></td>
          <td style="font-family: monospace; font-size: 12px;">${c.rule}</td>
          <td>${c.evidence ? '“' + c.evidence + '”' : 'Missing Evidence'}</td>
          <td>${c.confidence}%</td>
          <td class="status-${c.status}">${c.status === 'verified' ? 'VERIFIED' : c.status === 'violation' ? 'VIOLATION' : 'REVIEW'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <strong>Regulatory Disclaimer:</strong> This inspection audit was generated by the METRICHECK AI Enforcement Support System for Legal Metrology Officers. Under Legal Metrology Act, 2009, this document provides machine-verifiable evidence and decision support; authoritative statutory determination rests with the designated Legal Metrology Inspector.
  </div>
</body>
</html>`;

      if (Capacitor.isNativePlatform()) {
        const fileName = `Metricheck_Audit_${Date.now()}.html`;
        const writeRes = await Filesystem.writeFile({
          path: fileName,
          data: reportHtml,
          directory: Directory.Cache,
          encoding: 'utf8'
        });

        await Share.share({
          title: 'Legal Metrology Compliance Report',
          text: `Compliance Audit Report. Status: ${isCompliant ? 'COMPLIANT' : 'MANUAL REVIEW REQUIRED'}`,
          url: writeRes.uri,
          dialogTitle: 'Export / Share Compliance Report'
        });
      } else {
        const blob = new Blob([reportHtml], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        const printWin = window.open(blobUrl, '_blank');
        if (printWin) {
          printWin.focus();
          setTimeout(() => {
            printWin.print();
          }, 300);
        } else {
          window.print();
        }
      }
    } catch (err) {
      console.error("Failed to export report:", err);
      window.print();
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={reset}>
          <div className="brandMark"><Icon name="shield" size={24} /></div>
          <div>
            <div className="brandTitle">Metricheck</div>
            <div className="brandSub">COMPLIANCE SCANNER</div>
          </div>
        </div>
        <nav className="topNav">
          <button className={screen !== "rules" && screen !== "official" && screen !== "history" ? "active" : ""} onClick={reset}>Scan Package</button>
          <button className={screen === "history" ? "active" : ""} onClick={() => { stopCamera(); setScreen("history"); }}>Inspection History</button>
          <button className={screen === "rules" ? "active" : ""} onClick={() => { stopCamera(); setScreen("rules"); }}>System Capabilities</button>
          <button className={screen === "official" ? "active" : ""} onClick={() => { stopCamera(); setScreen("official"); }}>Official Rules</button>
        </nav>
        <div className="topStatus">
          {offlineQueueCount > 0 && (
            <button
              onClick={handleSync}
              style={{
                background: '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                marginRight: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isSyncing ? '⏳ Syncing...' : `🔄 Sync (${offlineQueueCount})`}
            </button>
          )}
          <span className="liveDot" /> Demo Environment <span className="divider" /> v1.0
        </div>
      </header>

      <main className="main">
        {screen === "scan" && (
          <section className="scanPage">
            <div className="heroBadge"><Icon name="shield" size={15} /> AI-ASSISTED COMPLIANCE INSPECTION</div>
            <h1>Scan Packaged<br /><span>Commodity</span></h1>
            <p className="heroCopy">Verify mandatory declarations against Legal Metrology rules using OCR-backed, explainable evidence.</p>

            <div className="scanCards">
              <button className="scanCard primary" onClick={handleCamera}>
                <div className="cardIcon"><Icon name="camera" size={30} /></div>
                <div className="cardText"><strong>Take Photo / Camera</strong><span>Capture a package directly</span></div>
                <Icon name="arrow" size={22} />
              </button>
              <button className="scanCard" onClick={handleGallery}>
                <div className="cardIcon"><Icon name="upload" size={30} /></div>
                <div className="cardText"><strong>Upload Package Image</strong><span>PNG, JPG or WEBP · up to 10 MB</span></div>
                <Icon name="arrow" size={22} />
              </button>
            </div>

            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} hidden />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />

            <div
              className={"dropzone " + (dragOver ? "dragging" : "")}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files?.[0]); }}
              onClick={handleGallery}
            >
              <div className="dropIcon"><Icon name="upload" size={22} /></div>
              <div><strong>Or drag & drop a package image here</strong><span>We’ll visually trace every verified declaration back to its source.</span></div>
            </div>

            <div className="journey">
              <div className="journeyTitle">WHAT HAPPENS NEXT</div>
              <div className="journeyLine">
                {["Upload / Scan", "Image Quality", "OCR Detection", "Field Extract", "Rule Engine", "Compliance Report"].map((x, i) =>
                  <React.Fragment key={x}>
                    <div className="journeyItem"><span>{String(i + 1).padStart(2, "0")}</span>{x}</div>
                    {i < 5 && <div className="journeyArrow">→</div>}
                  </React.Fragment>
                )}
              </div>
            </div>
          </section>
        )}

        {screen === "camera" && (
          <section className="cameraPage">
            <div className="cameraHeader">
              <h2>Take a Photo</h2>
              <p>Align the package within the frame and capture.</p>
            </div>
            <div className="cameraStage">
              <video ref={videoRef} playsInline muted className="cameraVideo"></video>
            </div>
            <div className="cameraActions">
              <button className="ghostBtn" onClick={() => { stopCamera(); setScreen("scan"); }}>Cancel</button>
              <button className="darkBtn captureBtn" onClick={capturePhoto}><Icon name="camera" size={20} /> Capture Photo</button>
            </div>
          </section>
        )}

        {screen === "processing" && (
          <section className="processingPage">
            <div className="processingHead">
              <div className="heroBadge"><Icon name="shield" size={15} /> ANALYSIS IN PROGRESS</div>
              <h2>Analyzing your package</h2>
              {error ? (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ color: '#ef4444', fontWeight: 600 }}>{error}</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button className="ghostBtn" style={{ padding: '8px 16px' }} onClick={reset}>← Try Another Scan</button>
                    {offlineQueueCount > 0 && (
                      <button
                        className="darkBtn"
                        style={{ padding: '8px 16px', background: '#ea580c', borderColor: '#ea580c' }}
                        onClick={async () => {
                          await handleSync();
                          reset();
                        }}
                      >
                        🔄 Sync Queued Scans ({offlineQueueCount})
                      </button>
                    )}
                  </div>
                </div>
              ) : <p>We’re building an evidence chain from image → OCR → field → rule → finding.</p>}
            </div>
            <div className="processingGrid">
              <div className="pipeline">
                {steps.map((step, i) => {
                  const done = i < pipelineStep;
                  const active = i === pipelineStep;
                  return <div className={"pipeRow " + (done ? "done" : "") + (active ? "active" : "")} key={step[0]}>
                    <div className="pipeNode">{done ? <Icon name="check" size={16} /> : <span>{i + 1}</span>}</div>
                    <div className="pipeContent"><strong>{step[0]}</strong><span>{step[1]}</span></div>
                    <div className="pipeState">{done ? "Complete" : active ? "Running" : "Queued"}</div>
                  </div>
                })}
              </div>
              <div className="previewCard">
                <div className="previewLabel"><span>INPUT IMAGE</span><span>LIVE</span></div>
                {image ? <img src={image} alt="Uploaded package" /> : <div className="imagePlaceholder"><Icon name="file" size={40} /></div>}
                <div className="scanSweep" />
              </div>
            </div>
          </section>
        )}

        {screen === "result" && (
          <section className="resultPage">
            <div className="resultHeader">
              <div>
                <div className="heroBadge"><Icon name="shield" size={15} /> METRICHECK SCAN RESULT</div>
                <h2>Compliance Report</h2>
                <p>Evidence-backed analysis of the package declarations.</p>
              </div>
              <div className="headerActions">
                <button className="ghostBtn" onClick={reset}><Icon name="refresh" size={17} /> New Scan</button>
                <button className="darkBtn" onClick={handleExportReport}><Icon name="download" size={17} /> Export Report</button>
              </div>
            </div>

            {/* Inspector Decision Action Banner */}
            {currentScanId && (
              <div style={{
                background: currentScanData?.inspector_decision ? "#0f172a" : "#1e1b4b",
                border: currentScanData?.inspector_decision ? "1px solid #334155" : "1px solid #6366f1",
                borderRadius: "10px",
                padding: "14px 18px",
                marginTop: "20px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.25)"
              }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#818cf8", letterSpacing: "1px", textTransform: "uppercase" }}>
                    Legal Metrology Enforcement
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", marginTop: "2px" }}>
                    {currentScanData?.inspector_decision
                      ? `Officer Enforcement: ${currentScanData.inspector_decision.decision.toUpperCase()}`
                      : "Officer Adjudication Pending"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                    {currentScanData?.inspector_decision
                      ? `Enforced by ${currentScanData.inspector_decision.officer_id || "Officer"} on ${new Date(currentScanData.inspector_decision.decided_at).toLocaleString('en-IN')}`
                      : "AI screening complete. Review declarations and bounding boxes below to confirm authoritative status."}
                  </div>
                </div>

                {!currentScanData?.inspector_decision && (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => handleResultDecision("compliant")}
                      disabled={isDecidingResult}
                      style={{
                        background: "#166534",
                        color: "#ffffff",
                        border: "1px solid #22c55e",
                        borderRadius: "6px",
                        padding: "9px 18px",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: isDecidingResult ? "not-allowed" : "pointer"
                      }}
                    >
                      Confirm Compliant
                    </button>
                    <button
                      onClick={() => handleResultDecision("violation")}
                      disabled={isDecidingResult}
                      style={{
                        background: "#991b1b",
                        color: "#ffffff",
                        border: "1px solid #ef4444",
                        borderRadius: "6px",
                        padding: "9px 18px",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: isDecidingResult ? "not-allowed" : "pointer"
                      }}
                    >
                      Confirm Violation
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className={"summary " + (review === 0 && violations === 0 ? "successSummary" : violations > 0 ? "violationSummary" : "")}>
              <div className="summaryIcon"><Icon name={violations > 0 ? "x" : review === 0 ? "check" : "alert"} size={28} /></div>
              <div>
                <div className="summaryTitle">
                  {violations > 0 ? "VIOLATIONS DETECTED" : review === 0 ? "ALL CHECKS PASSED" : "MANUAL REVIEW REQUIRED"}
                </div>
                <strong>{verified} / {checks.length} declarations verified</strong>
                <span>
                  {violations > 0 ? "One or more declarations violate Legal Metrology rules." : review === 0 ? "All mandatory declarations were successfully extracted and verified." : "One or more declarations need visual confirmation before final approval."}
                </span>
              </div>
              <div className="summaryStats">
                <div><b>{verified}</b><small>VERIFIED</small></div>
                <div><b>{review}</b><small>REVIEW</small></div>
                {violations > 0 && <div><b>{violations}</b><small>VIOLATION</small></div>}
              </div>
            </div>

            <div className="resultLayout">
              <div className="checksPanel">
                <div className="sectionTitle"><span>Compliance Checks</span><small>{checks.length} compliance checks evaluated</small></div>
                <div className="checkList">
                  {checks.map(c => <button key={c.id} className={"checkCard " + (selected === c.id ? "selected" : "")} onClick={() => setSelected(c.id)}>
                    <div className={"statusIcon " + c.status}>{c.status === "verified" ? <Icon name="check" size={18} /> : c.status === "violation" ? <Icon name="x" size={18} /> : <Icon name="alert" size={18} />}</div>
                    <div className="checkInfo"><strong>{c.label}</strong><b>{c.value}</b><span>{c.shortRule} · Confidence {c.confidence}%</span></div>
                    <div className={"statusPill " + c.status}>{c.status === "verified" ? "VERIFIED" : c.status === "violation" ? "VIOLATION" : "REVIEW"}</div>
                    <Icon name="chevron" size={18} />
                  </button>)}
                </div>
              </div>

              <div className="evidencePanel">
                <EvidenceViewer image={image} selected={selectedCheck} checks={checks} rawOcrBoxes={rawOcrBoxes} onSelect={setSelected} />
              </div>
            </div>
          </section>
        )}

        {screen === "history" && (
          <HistoryPage
            onSelectScan={loadScanDetail}
            offlineQueueCount={offlineQueueCount}
            onSync={handleSync}
            isSyncing={isSyncing}
            onClearQueue={async () => {
              if (window.confirm("Clear all pending offline scans from this device?")) {
                await clearOfflineQueue();
                loadQueueCount();
              }
            }}
          />
        )}
        {screen === "rules" && <RulesPage />}
        {screen === "official" && <OfficialRulesPage />}
      </main>
      <footer><span>Metricheck Prototype</span><span>OCR → Evidence → Rule → Finding</span></footer>
    </div>
  );
}

function EvidenceViewer({ image, selected, checks, rawOcrBoxes = [], onSelect }) {
  const [showWhy, setShowWhy] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [imgSize, setImgSize] = useState(null);
  const [containerSize, setContainerSize] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    setImgSize(null);
  }, [image]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [selected]);

  const updateImgSize = (img) => {
    if (!img) return;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const handleImageLoad = (e) => {
    updateImgSize(e.target);
  };

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      updateImgSize(imgRef.current);
    }
  }, [image, selected]);

  let renderedW = 0, renderedH = 0, offsetX = 0, offsetY = 0;
  if (imgSize && containerSize) {
    const scaleX = containerSize.w / imgSize.w;
    const scaleY = containerSize.h / imgSize.h;
    
    // objectFit is 'contain'
    const scale = Math.min(scaleX, scaleY);

    renderedW = imgSize.w * scale;
    renderedH = imgSize.h * scale;
    offsetX = (containerSize.w - renderedW) / 2;
    offsetY = (containerSize.h - renderedH) / 2;
  }

  if (!selected) {
    return <div className="evidenceWrap">
      <div className="sectionTitle evidenceTitle">
        <span>No Results Found</span>
      </div>
    </div>;
  }

  return <div className="evidenceWrap">
    <div className="sectionTitle evidenceTitle">
      <span>Evidence Viewer</span>
      <small>Click a rule to highlight its OCR evidence</small>
    </div>
    <div className="viewer">
      <div className="viewerToolbar">
        <span><span className="greenDot" /> OCR BOUNDING BOXES</span>
        <button 
          onClick={() => setIsFullscreen(true)} 
          style={{ background: 'transparent', border: 'none', color: '#697589', cursor: 'pointer', padding: '4px', display: 'flex' }} 
          title="View full image size"
        >
          <Icon name="expand" size={16} />
        </button>
      </div>
      <div className="imageStage" ref={containerRef} style={{ position: 'relative' }}>
        {image ? (
          <div style={{ width: '100%', height: '100%', overflow: isFullscreen && zoom > 1 ? 'auto' : 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: '100%', height: '100%', position: 'relative', flex: '0 0 auto', transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }}>
              <img 
                ref={imgRef}
                src={image} 
                alt="Package evidence" 
                onLoad={handleImageLoad}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            {imgSize && containerSize && (
              <div className="boxesLayer" style={{ 
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                left: offsetX,
                top: offsetY,
                width: renderedW,
                height: renderedH,
                right: 'auto',
                bottom: 'auto',
                transition: 'transform 0.2s ease'
              }}>
                {/* Render raw OCR boxes behind compliance checks */}
                {rawOcrBoxes.map(box => <div key={box.id}
                  style={{
                    left: box.box.x + "%",
                    top: box.box.y + "%",
                    width: box.box.w + "%",
                    height: box.box.h + "%",
                    position: "absolute",
                    border: "1px dashed rgba(255, 255, 255, 0.25)",
                    pointerEvents: "none"
                  }}
                  title={box.text}
                />)}

                {checks.map(c => <button key={c.id} className={"ocrBox " + (selected && c.id === selected.id ? "focus " : "") + (c.status === "review" ? "reviewBox" : "")}
                  style={{ left: c.box.x + "%", top: c.box.y + "%", width: c.box.w + "%", height: c.box.h + "%" }}
                  onClick={() => onSelect(c.id)} title={c.evidence}>
                  <span>{selected && c.id === selected.id ? c.evidence : ""}</span>
                </button>)}
              </div>
            )}
            </div>
          </div>
        ) : <div className="imagePlaceholder"><Icon name="file" size={42} /></div>}
      </div>
    </div>

    <div className="evidenceDetail">
      <div className="detailTop"><div><span className={"miniStatus " + selected.status}>{selected.status === "verified" ? "✓" : "!"}</span><strong>{selected.label}</strong></div><button onClick={() => setShowWhy(v => !v)}><Icon name="info" size={16} /> Why was this result produced?</button></div>
      <div className="evidenceQuote">“{selected.evidence}”</div>
      <div className="detailGrid">
        <div><label>CONFIDENCE</label><strong>{selected.confidence}%</strong></div>
        <div><label>SOURCE</label><strong>Backend OCR</strong></div>
        <div><label>RULE</label><strong>{selected.rule}</strong></div>
        <div><label>DECISION</label><strong className={selected.status}>{selected.backendStatus}</strong></div>
      </div>
      {showWhy && <div className="whyBox">
        <div className="whyTitle"><Icon name="info" size={17} /> Explainability</div>
        <div className="whyRows">
          <div><span>Rule</span><b>{selected.rule}</b></div>
          <div><span>Requirement</span><b>{selected.requirement}</b></div>
          <div><span>Detected evidence</span><b>“{selected.evidence}”</b></div>
          <div><span>OCR confidence</span><b>{selected.confidence}%</b></div>
          <div><span>Evidence location</span><b>[{Math.round(selected.box.x)}, {Math.round(selected.box.y)}, {Math.round(selected.box.w)}, {Math.round(selected.box.h)}]</b></div>
          <div><span>Decision</span><b className={selected.status}>{selected.backendStatus}</b></div>
        </div>
      </div>}
    </div>

    {isFullscreen && (
      <div className="floatingLightbox" onClick={() => setIsFullscreen(false)}>
        <div className="floatingLightboxContent" onClick={e => e.stopPropagation()}>
          <button className="floatingLightboxClose" onClick={() => setIsFullscreen(false)}>
            <Icon name="x" size={32} />
          </button>
          {image && (
            <div style={{ 
              position: 'relative', 
              width: (window.Capacitor && window.Capacitor.isNativePlatform() && imgSize?.w) ? Math.min(imgSize.w, window.innerWidth * 2.5) : (imgSize?.w || 'auto'), 
              height: 'auto' 
            }}>
              <img 
                src={image} 
                style={{ display: 'block', width: '100%', height: 'auto' }} 
                alt="Full size evidence" 
              />
              {imgSize && (
                <div className="boxesLayer" style={{ left: 0, top: 0, width: '100%', height: '100%', right: 'auto', bottom: 'auto' }}>
                  {rawOcrBoxes.map(box => <div key={box.id}
                    style={{
                      left: box.box.x + "%",
                      top: box.box.y + "%",
                      width: box.box.w + "%",
                      height: box.box.h + "%",
                      position: "absolute",
                      border: "1px dashed rgba(255, 255, 255, 0.4)",
                      pointerEvents: "none"
                    }}
                    title={box.text}
                  />)}

                  {checks.map(c => <button key={c.id} className={"ocrBox " + (selected && c.id === selected.id ? "focus " : "") + (c.status === "review" ? "reviewBox" : "")}
                    style={{ left: c.box.x + "%", top: c.box.y + "%", width: c.box.w + "%", height: c.box.h + "%" }}
                    onClick={() => { onSelect(c.id); setIsFullscreen(false); }} title={c.evidence}>
                    <span>{selected && c.id === selected.id ? c.evidence : ""}</span>
                  </button>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
}

function RulesPage() {
  const [activeTab, setActiveTab] = useState(null);

  return (
    <section className="rulesPage">
      <div className="rulesHero">
        <div className="heroBadge"><Icon name="book" size={15} /> RULES & REGULATIONS</div>
        <h1>Compliance Rules<br /><span>We Check</span></h1>
        <p className="heroCopy">
          Our scanner evaluates mandatory declarations on packaged commodities based on applicable Legal Metrology rules.
          Results are based on OCR evidence and rule-engine validation. Ambiguous cases may require manual review.
        </p>
      </div>

      <div className="rulesSection">
        <div className="sectionTitle">
          <span>Currently Implemented Rules</span>
          <small>Verified by our deterministic extraction engine</small>
        </div>
        <div className="rulesGrid">
          {rulesData.map(rule => (
            <div key={rule.rule_id} className="ruleCard">
              <div className="ruleHeader">
                <span className="ruleId">{rule.rule_id}</span>
                <span className={"statusBadge " + rule.implementation_status}>
                  {rule.implementation_status === "implemented" ? "✓ Implemented" :
                    rule.implementation_status === "partial" ? "🟡 Partial / Manual Review" : "Coming Soon"}
                </span>
              </div>
              <h3 className="ruleTitle">{rule.title}</h3>
              <p className="ruleDesc">{rule.short_description}</p>

              <div className="ruleCheck">
                <strong>System Check:</strong> {rule.system_check_description}
              </div>

              <div className="ruleExamples">
                <strong>Examples:</strong>
                <div className="exampleList">
                  {rule.examples.map((ex, i) => <span key={i} className="exampleTag">{ex}</span>)}
                </div>
              </div>

              <div className="ruleLegal">
                <button className="legalToggle" onClick={() => setActiveTab(activeTab === rule.rule_id ? null : rule.rule_id)}>
                  <span><Icon name="scale" size={16} /> View Legal Text</span>
                  {activeTab === rule.rule_id ? <Icon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} /> : <Icon name="chevron" size={16} />}
                </button>
                {activeTab === rule.rule_id && (
                  <div className="legalContent">
                    <strong>{rule.legal_reference}</strong>
                    <p>"{rule.legal_text}"</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rulesSection">
        <div className="sectionTitle">
          <span>Rules Can Vary by Product Category</span>
          <small>Different categories may require specialised declarations</small>
        </div>
        <div className="categoryGrid">
          {categoriesData.map(cat => (
            <div key={cat.id} className="categoryCard">
              <h4>{cat.title}</h4>
              <p>{cat.description}</p>

              <div className="catRules">
                <div className="catCol">
                  <strong>Currently Supported</strong>
                  <ul>
                    {cat.implemented_rules.map(r => <li key={r}><Icon name="check" size={12} /> {r}</li>)}
                  </ul>
                </div>
                <div className="catCol futureCol">
                  <strong>Future Checks</strong>
                  <ul>
                    {cat.future_rules.map(r => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


    </section>
  );
}

function OfficialRulesPage() {
  return (
    <section className="officialRulesPage">
      <div className="heroBadge"><Icon name="book" size={15} /> LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011</div>
      <h1 style={{ fontSize: '32px', marginBottom: '12px', marginTop: '16px' }}>Official Rules Reference</h1>
      <p className="heroCopy" style={{ maxWidth: '800px', marginBottom: '40px' }}>
        This table maps the official legal rules to our system's current and future AI capabilities.
        It explicitly outlines what the scanner checks, what is planned, and what is fundamentally out of scope for image-based verification.
      </p>

      <div className="rulesTableWrapper">
        <table className="rulesTable">
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Rule</th>
              <th style={{ width: '35%' }}>Official Description</th>
              <th style={{ width: '20%' }}>System Status</th>
              <th style={{ width: '30%' }}>System Handling / Notes</th>
            </tr>
          </thead>
          <tbody>
            {officialRulesTable.map((rule, idx) => (
              <tr key={idx}>
                <td>
                  <span className="rtRuleId">{rule.rule}</span>
                  <div className="rtTitle">{rule.title}</div>
                </td>
                <td><div className="rtDesc">{rule.description}</div></td>
                <td>
                  <span className={"statusBadge " + rule.status}>
                    {rule.status === "implemented" ? "Implemented" :
                      rule.status === "partial" ? "Partial / Future" :
                        rule.status === "coming_soon" ? "Coming Soon" : "Out of Scope"}
                  </span>
                </td>
                <td><div className="rtNotes">{rule.notes}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HistoryPage({ onSelectScan, offlineQueueCount = 0, onSync, isSyncing = false, onClearQueue }) {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [identifyingIds, setIdentifyingIds] = useState([]);
  const [decidingIds, setDecidingIds] = useState([]);

  const handleIdentify = async (scanId) => {
    setIdentifyingIds((prev) => [...prev, scanId]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/scans/${scanId}/identify`, {
        method: "POST"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail?.message || errData.detail || "Identification failed");
      }
      const updatedItem = await res.json();
      setHistory((prev) =>
        prev.map((s) => (s.scan_id === updatedItem.scan_id ? updatedItem : s))
      );
    } catch (err) {
      console.error("Brand identification error:", err);
      alert(`Identification Error: ${err.message}`);
    } finally {
      setIdentifyingIds((prev) => prev.filter((id) => id !== scanId));
    }
  };

  const handleDecision = async (scanId, decision) => {
    const confirmMsg = decision === "compliant"
      ? "Confirm this package is fully COMPLIANT with Legal Metrology (Packaged Commodities) Rules, 2011?"
      : "Confirm this package is in VIOLATION of Legal Metrology (Packaged Commodities) Rules, 2011?";
    if (!window.confirm(confirmMsg)) return;

    setDecidingIds((prev) => [...prev, scanId]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/scans/${scanId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: decision,
          officer_id: "OFFICER-DEFAULT",
          notes: `Confirmed ${decision} by officer in audit review`,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to record inspector decision");
      }

      setHistory((prev) =>
        prev.map((s) => {
          if (s.scan_id === scanId) {
            const addedRules = s.review_rules_count || 0;
            return {
              ...s,
              status: decision,
              inspector_decision: decision,
              inspector_id: "OFFICER-DEFAULT",
              compliant_rules_count: decision === "compliant" ? (s.compliant_rules_count + addedRules) : s.compliant_rules_count,
              violation_rules_count: decision === "violation" ? (s.violation_rules_count + addedRules) : s.violation_rules_count,
              review_rules_count: 0,
            };
          }
          return s;
        })
      );

      const statsRes = await fetch(`${API_BASE_URL}/api/scans/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Decision error:", err);
      alert(`Decision Error: ${err.message}`);
    } finally {
      setDecidingIds((prev) => prev.filter((id) => id !== scanId));
    }
  };


  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const statsRes = await fetch(`${API_BASE_URL}/api/scans/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      let url = `${API_BASE_URL}/api/scans/history?limit=50`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const historyRes = await fetch(url);
      if (!historyRes.ok) throw new Error(`Failed to load history (${historyRes.status})`);
      const historyData = await historyRes.json();
      setHistory(historyData.items || []);
    } catch (err) {
      console.error("History fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div style={{ padding: "16px 12px 60px 12px", maxWidth: "1100px", margin: "0 auto", color: "#f8fafc" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 800, color: "#38bdf8", letterSpacing: "1px", textTransform: "uppercase" }}>
            Audit Registry
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "2px 0 0 0", color: "#ffffff", letterSpacing: "-0.5px" }}>
            Inspection History
          </h2>
        </div>
        <button
          onClick={fetchData}
          style={{
            background: "#1e293b",
            color: "#38bdf8",
            border: "1px solid #475569",
            borderRadius: "6px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Refresh
        </button>
      </div>

      {/* Offline Queue Active Banner */}
      {offlineQueueCount > 0 && (
        <div style={{
          background: "#431407",
          border: "1px solid #ea580c",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap"
        }}>
          <div>
            <div style={{ fontWeight: 800, color: "#ffedd5", fontSize: "14px" }}>
              ⚡ Offline Queue Active
            </div>
            <div style={{ color: "#fdba74", fontSize: "12px", marginTop: "2px" }}>
              {offlineQueueCount} scan{offlineQueueCount > 1 ? "s" : ""} waiting to sync. Connect and sync to database.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={async () => {
                if (onSync) await onSync();
                fetchData();
              }}
              disabled={isSyncing}
              style={{
                background: "#ea580c",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: isSyncing ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {isSyncing ? "⏳ Syncing..." : `🔄 Sync Now (${offlineQueueCount})`}
            </button>
            {onClearQueue && (
              <button
                onClick={onClearQueue}
                style={{
                  background: "#1e293b",
                  color: "#fca5a5",
                  border: "1px solid #7f1d1d",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontWeight: 600,
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* High-Contrast KPI Summary Cards (No symbols) */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "18px" }}>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "12px 14px" }}>
            <div style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: 700, letterSpacing: "0.5px" }}>TOTAL SCANS</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>{stats.total_scans}</div>
          </div>
          <div style={{ background: "#1e293b", border: "1px solid #166534", borderRadius: "8px", padding: "12px 14px" }}>
            <div style={{ fontSize: "12px", color: "#86efac", fontWeight: 700, letterSpacing: "0.5px" }}>COMPLIANT</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#4ade80", marginTop: "4px" }}>{stats.compliant_count}</div>
          </div>
          <div style={{ background: "#1e293b", border: "1px solid #854d0e", borderRadius: "8px", padding: "12px 14px" }}>
            <div style={{ fontSize: "12px", color: "#fde047", fontWeight: 700, letterSpacing: "0.5px" }}>REVIEW REQUIRED</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#facc15", marginTop: "4px" }}>{stats.manual_review_count}</div>
          </div>
          <div style={{ background: "#1e293b", border: "1px solid #991b1b", borderRadius: "8px", padding: "12px 14px" }}>
            <div style={{ fontSize: "12px", color: "#fca5a5", fontWeight: 700, letterSpacing: "0.5px" }}>VIOLATIONS</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#ef4444", marginTop: "4px" }}>{stats.violation_count || 0}</div>
          </div>
          <div style={{ background: "#1e293b", border: "1px solid #075985", borderRadius: "8px", padding: "12px 14px" }}>
            <div style={{ fontSize: "12px", color: "#7dd3fc", fontWeight: 700, letterSpacing: "0.5px" }}>OFFLINE SYNCED</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#38bdf8", marginTop: "4px" }}>{stats.offline_synced_count}</div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <input
          type="text"
          placeholder="Search by brand, product, or scan ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: "#1e293b",
            border: "1px solid #475569",
            borderRadius: "6px",
            padding: "10px 14px",
            color: "#ffffff",
            fontSize: "14px",
            outline: "none"
          }}
        />
        <button
          type="submit"
          style={{
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "10px 20px",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer"
          }}
        >
          Search
        </button>
      </form>

      {/* Filter Tabs (No symbols) */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "12px" }}>
        {[
          { label: "All Records", val: "" },
          { label: "Compliant", val: "compliant" },
          { label: "Review Required", val: "manual_review_required" },
          { label: "Violations", val: "violation" },
          { label: "Pending Fallback", val: "pending_fallback" }
        ].map((item) => (
          <button
            key={item.val}
            onClick={() => setStatusFilter(item.val)}
            style={{
              background: statusFilter === item.val ? "#2563eb" : "#1e293b",
              color: statusFilter === item.val ? "#ffffff" : "#cbd5e1",
              border: statusFilter === item.val ? "1px solid #60a5fa" : "1px solid #334155",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 700,
              whiteSpace: "nowrap",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Content View: High-Contrast Solid Cards */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#cbd5e1", fontSize: "15px" }}>Loading inspection records...</div>
      ) : error ? (
        <div style={{ background: "#450a0a", border: "1px solid #ef4444", borderRadius: "8px", padding: "16px", color: "#fca5a5" }}>
          Error: {error}
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#1e293b", borderRadius: "8px", border: "1px solid #334155" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff" }}>No Inspections Found</div>
          <div style={{ fontSize: "14px", color: "#cbd5e1", marginTop: "6px" }}>
            Any package scanned online or queued offline will be listed here with full legal evidence.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
          {history.map((item) => {
            const isCompliant = item.status === "compliant";
            const isReview = item.status === "manual_review_required" || item.status === "review";
            const isPending = item.status === "pending_fallback";

            const badgeBg = isCompliant ? "#14532d" : isReview ? "#78350f" : isPending ? "#0c4a6e" : "#7f1d1d";
            const badgeColor = isCompliant ? "#86efac" : isReview ? "#fde047" : isPending ? "#7dd3fc" : "#fca5a5";
            const badgeBorder = isCompliant ? "#22c55e" : isReview ? "#eab308" : isPending ? "#0284c7" : "#ef4444";
            const statusText = isCompliant ? "COMPLIANT" : isReview ? "REVIEW REQUIRED" : isPending ? "PENDING CLOUD" : "VIOLATION";

            const displayBrand = item.brand_name || "Brand Unidentified";
            const displayProduct = item.product_name || "Packaged Commodity";
            const isBrandKnown = Boolean(item.brand_name && item.brand_name !== "Unidentified Brand" && item.brand_name !== "Packaged Brand");
            const canFindBrand = !item.brand_name || item.identification_status !== "IDENTIFIED";
            const isIdentifyingThis = identifyingIds.includes(item.scan_id);

            return (
              <div
                key={item.scan_id}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)"
                }}
              >
                <div>
                  {/* Card Top: Brand, Product, Manufacturer & Status Badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "14px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                        <span
                          style={{
                            background: isBrandKnown ? "#1e3a8a" : "#334155",
                            color: isBrandKnown ? "#bfdbfe" : "#cbd5e1",
                            border: `1px solid ${isBrandKnown ? "#3b82f6" : "#475569"}`,
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontWeight: 800,
                            fontSize: "11px",
                            letterSpacing: "0.5px",
                            textTransform: "uppercase"
                          }}
                        >
                          {displayBrand}
                        </span>

                        {/* Identification Method Badge */}
                        {isBrandKnown && (
                          <span
                            style={{
                              background: item.identification_method === "AI_ASSISTED" ? "#3b0764" : "#064e3b",
                              color: item.identification_method === "AI_ASSISTED" ? "#d8b4fe" : "#a7f3d0",
                              border: `1px solid ${item.identification_method === "AI_ASSISTED" ? "#9333ea" : "#059669"}`,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: 700,
                              fontSize: "10px",
                              letterSpacing: "0.5px"
                            }}
                          >
                            {item.identification_method === "AI_ASSISTED" ? "AI Identified" : "Deterministic"}
                          </span>
                        )}

                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", wordBreak: "break-word" }}>
                          {displayProduct}
                        </span>
                      </div>

                      {/* Manufacturer Name (Rule 6(1)(a)) */}
                      {item.manufacturer_name && (
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "3px", fontWeight: 500 }}>
                          Mfg: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{item.manufacturer_name}</span>
                        </div>
                      )}

                      {/* Evidence string if present */}
                      {item.identification_evidence && item.identification_evidence.length > 0 && (
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Evidence: {item.identification_evidence[0]}
                        </div>
                      )}

                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", fontFamily: "monospace" }}>
                        ID: {item.scan_id.substring(0, 8).toUpperCase()} • {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <span
                      style={{
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeBorder}`,
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontWeight: 800,
                        fontSize: "11px",
                        whiteSpace: "nowrap",
                        letterSpacing: "0.5px",
                        flexShrink: 0
                      }}
                    >
                      {statusText}
                    </span>
                  </div>

                  {/* Card Body: High-Contrast Key Declarations Grid */}
                  <div
                    style={{
                      background: "#0f172a",
                      borderRadius: "8px",
                      padding: "12px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginBottom: "16px",
                      border: "1px solid #334155"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.5px" }}>PRICE (MRP)</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: item.mrp ? "#ffffff" : "#94a3b8", marginTop: "2px" }}>
                        {item.mrp ? `₹${item.mrp}` : "Not declared"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.5px" }}>NET WEIGHT</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: item.net_quantity ? "#ffffff" : "#94a3b8", marginTop: "2px" }}>
                        {item.net_quantity || "Under review"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.5px" }}>MFG DATE</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: item.manufacturing_date ? "#ffffff" : "#94a3b8", marginTop: "2px" }}>
                        {item.manufacturing_date || "Not detected"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.5px" }}>CONSUMER CARE</div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: item.consumer_care ? "#ffffff" : "#94a3b8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.consumer_care ? item.consumer_care.substring(0, 16) : "Under review"}
                      </div>
                    </div>
                  </div>

                  {/* Inspector Decision Actions for Manual Review Items */}
                  {isReview && (
                    <div style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "14px",
                      padding: "10px 12px",
                      background: "#1e1b4b",
                      borderRadius: "8px",
                      border: "1px solid #4338ca",
                      alignItems: "center"
                    }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "#a5b4fc", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        Officer:
                      </div>
                      <button
                        onClick={() => handleDecision(item.scan_id, "compliant")}
                        disabled={decidingIds.includes(item.scan_id)}
                        style={{
                          flex: 1,
                          background: "#166534",
                          color: "#ffffff",
                          border: "1px solid #22c55e",
                          borderRadius: "6px",
                          padding: "7px 10px",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor: decidingIds.includes(item.scan_id) ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        Confirm Compliant
                      </button>
                      <button
                        onClick={() => handleDecision(item.scan_id, "violation")}
                        disabled={decidingIds.includes(item.scan_id)}
                        style={{
                          flex: 1,
                          background: "#991b1b",
                          color: "#ffffff",
                          border: "1px solid #ef4444",
                          borderRadius: "6px",
                          padding: "7px 10px",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor: decidingIds.includes(item.scan_id) ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        Confirm Violation
                      </button>
                    </div>
                  )}

                  {/* Officer Adjudication Badge if already decided */}
                  {item.inspector_decision && (
                    <div style={{
                      marginBottom: "12px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: item.inspector_decision === "compliant" ? "#064e3b" : "#450a0a",
                      border: `1px solid ${item.inspector_decision === "compliant" ? "#059669" : "#dc2626"}`,
                      color: item.inspector_decision === "compliant" ? "#6ee7b7" : "#fca5a5",
                      fontSize: "11px",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}>
                      <span>ENFORCEMENT: {item.inspector_decision.toUpperCase()}</span>
                      <span style={{ fontSize: "10px", opacity: 0.85 }}>{item.inspector_id || "OFFICER"}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Source & Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "auto", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: item.sync_source === "offline_sync" ? "#fdba74" : "#cbd5e1"
                    }}
                  >
                    {item.sync_source === "offline_sync" ? "Offline Synced" : "Real-time Scan"}
                  </span>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {/* Targeted Find Brand Info Button */}
                    {canFindBrand && (
                      <button
                        onClick={() => handleIdentify(item.scan_id)}
                        disabled={isIdentifyingThis}
                        style={{
                          background: isIdentifyingThis ? "#4c1d95" : "#7c3aed",
                          color: "#ffffff",
                          border: "1px solid #8b5cf6",
                          borderRadius: "6px",
                          padding: "8px 14px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: isIdentifyingThis ? "not-allowed" : "pointer",
                          opacity: isIdentifyingThis ? 0.8 : 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.15s ease"
                        }}
                      >
                        {isIdentifyingThis ? "Identifying..." : "Find Brand Info"}
                      </button>
                    )}

                    <button
                      onClick={() => onSelectScan(item.scan_id)}
                      style={{
                        background: "#2563eb",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "background 0.15s ease"
                      }}
                    >
                      Inspect Report
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
