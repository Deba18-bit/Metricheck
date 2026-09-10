import { Network } from '@capacitor/network';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

const QUEUE_KEY = 'offline_scans_queue';
export const API_BASE_URL = 'http://localhost:8000';

export async function isOnline() {
  // On native devices, check real network status (Wi-Fi/cellular).
  // This correctly returns false when Wi-Fi is off, even if USB tunnel is active.
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus();
      return Boolean(status && status.connected);
    } catch (_) {
      return false;
    }
  }
  // On web browser, use navigator.onLine
  return navigator.onLine;
}

// Separate check used by syncOfflineScans — this one pings the backend
// to confirm the server is truly reachable before attempting upload.
export async function isBackendReachable() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function getOfflineQueue() {
  try {
    const { value } = await Preferences.get({ key: QUEUE_KEY });
    return value ? JSON.parse(value) : [];
  } catch (err) {
    console.error("Failed to read offline queue:", err);
    return [];
  }
}

export async function clearOfflineQueue() {
  try {
    const queue = await getOfflineQueue();
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      for (const scan of queue) {
        if (scan.fileName) {
          try {
            await Filesystem.deleteFile({
              path: scan.fileName,
              directory: Directory.Data
            });
          } catch (_) {}
        }
      }
    }
    await Preferences.remove({ key: QUEUE_KEY });
    return true;
  } catch (err) {
    console.error("clearOfflineQueue error:", err);
    return false;
  }
}

export function base64ToBlob(base64, mimeType = 'image/jpeg') {
  if (!base64 || typeof base64 !== 'string') return null;
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  try {
    const byteCharacters = atob(cleanBase64.replace(/\s/g, ''));
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: mimeType });
  } catch (err) {
    console.warn("base64ToBlob error:", err);
    return null;
  }
}

export async function saveScanOffline(imageWebPath, edgePayload, nativePath = null) {
  try {
    const queue = await getOfflineQueue();
    const scanId = 'offline_' + Date.now();
    let base64Data = null;

    if (imageWebPath) {
      try {
        const res = await fetch(imageWebPath);
        const blob = await res.blob();
        base64Data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const raw = reader.result;
            resolve(raw && typeof raw === 'string' ? raw.split(',')[1] : null);
          };
        });
      } catch (fetchErr) {
        console.warn("Could not fetch imageWebPath for offline save:", fetchErr);
      }
    }

    if (!base64Data && nativePath && window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        const fileData = await Filesystem.readFile({ path: nativePath });
        if (fileData?.data) {
          base64Data = typeof fileData.data === 'string' ? fileData.data : null;
        }
      } catch (readErr) {
        console.warn("Could not read nativePath for offline save:", readErr);
      }
    }

    const fileName = `${scanId}.jpg`;

    if (base64Data && window.Capacitor && window.Capacitor.isNativePlatform()) {
      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Data
      }).catch(e => console.warn("Failed to write offline file:", e));
    }

    const enrichedPayload = {
      ...edgePayload,
      client_scan_id: scanId,
      sync_source: "offline_sync",
      is_offline_sync: true,
      client_timestamp: new Date().toISOString()
    };

    queue.push({
      id: scanId,
      timestamp: Date.now(),
      fileName,
      edgePayload: enrichedPayload,
      base64Data: window.Capacitor && window.Capacitor.isNativePlatform() ? null : base64Data
    });

    await Preferences.set({
      key: QUEUE_KEY,
      value: JSON.stringify(queue)
    });

    return scanId;
  } catch (err) {
    console.error("saveScanOffline error:", err);
    return null;
  }
}

export async function syncOfflineScans() {
  // Use backend health check — works over USB tunnel even with Wi-Fi off
  if (!(await isBackendReachable())) return false;

  let queue = await getOfflineQueue();
  if (queue.length === 0) return true;

  let successCount = 0;

  for (let i = 0; i < queue.length; i++) {
    const scan = queue[i];
    try {
      // 1. Post Edge OCR payload
      const edgeResponse = await fetch(`${API_BASE_URL}/api/scans/edge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scan.edgePayload)
      });

      if (!edgeResponse.ok) {
        // If the server rejected the payload with 4xx client error (unsupported/invalid),
        // drop this stuck scan to prevent permanently blocking the sync queue
        if (edgeResponse.status >= 400 && edgeResponse.status < 500) {
          console.warn(`Skipping unprocessable scan ${scan.id} (status ${edgeResponse.status})`);
          if (window.Capacitor && window.Capacitor.isNativePlatform() && scan.fileName) {
            await Filesystem.deleteFile({
              path: scan.fileName,
              directory: Directory.Data
            }).catch(() => {});
          }
          successCount++;
          continue;
        }
        throw new Error("Edge OCR failed during sync (" + edgeResponse.status + ")");
      }

      let data = await edgeResponse.json();

      // 2. Post fallback if needed
      if (data.status === "pending_fallback") {
        let blob = null;
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
          try {
            const fileData = await Filesystem.readFile({
              path: scan.fileName,
              directory: Directory.Data
            });
            if (fileData?.data) {
              blob = base64ToBlob(fileData.data, 'image/jpeg');
            }
          } catch (fileErr) {
            console.warn("Could not read offline image file for fallback:", fileErr);
          }
        } else if (scan.base64Data) {
          blob = base64ToBlob(scan.base64Data, 'image/jpeg');
        }

        if (blob) {
          const formData = new FormData();
          formData.append("image", blob, "fallback.jpg");

          const fallbackResponse = await fetch(`${API_BASE_URL}/api/scans/${data.scan_id}/fallback`, {
            method: 'POST',
            body: formData
          });
          if (!fallbackResponse.ok && fallbackResponse.status >= 500) {
            throw new Error("Fallback failed during sync (" + fallbackResponse.status + ")");
          }
        }
      }

      // Success, clean up file
      if (window.Capacitor && window.Capacitor.isNativePlatform() && scan.fileName) {
        await Filesystem.deleteFile({
          path: scan.fileName,
          directory: Directory.Data
        }).catch(e => console.warn("Failed to delete offline file:", e));
      }
      successCount++;
    } catch (err) {
      console.error("Sync paused at scan " + scan.id + ":", err);
      // Stop on network / server disconnection to preserve remaining queue
      break;
    }
  }

  // Update queue, keeping only what failed
  const remainingQueue = queue.slice(successCount);
  await Preferences.set({
    key: QUEUE_KEY,
    value: JSON.stringify(remainingQueue)
  });

  return remainingQueue.length === 0;
}
