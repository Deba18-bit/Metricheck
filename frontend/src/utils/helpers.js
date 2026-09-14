export function loadImageToCanvas(imgSrc) {
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
export function preprocessDotMatrix(ctx, width, height) {
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
export function bboxOverlaps(a, b) {
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
export function mergeOcrPasses(originalItems, preprocessedItems) {
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


export function extractRawOcrBoxes(response) {
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

export function mapBackendResponseToChecks(response) {
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
