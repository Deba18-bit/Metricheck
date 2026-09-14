# API Contract

Describes the rigid API contracts between the frontend (Web/Capacitor) and the FastAPI backend.

## 1. POST /api/scans/edge
**Role:** Initial submission of edge-calculated MLKit OCR.
- **Payload:** `{"image_id": string, "source_width": int, "source_height": int, "items": [{"text": string, "bbox": [L, T, R, B]}]}`
- **Response:** 
  - `{"status": "pending_fallback", "scan_id": string}` (needs Gemini visual extraction)
  - OR `ScanResponse` (Full compliance payload)

## 2. POST /api/scans/{id}/fallback
**Role:** Fallback image upload for Gemini extraction.
- **Payload:** `multipart/form-data` with `image` file.
- **Response:** `ScanResponse`

## 3. GET /api/scans/{id}
**Role:** Fetch historical/existing scan.
- **Response:** `ScanResponse`

## 4. POST /api/scans/{id}/decision
**Role:** Inspector manual audit decision.
- **Payload:** `{"decision": "COMPLIANT" | "VIOLATION", "officer_id": string, "notes": string}`
- **Response:** `ScanResponse`

## 5. GET /api/scans/history
**Role:** Fetch history array.
- **Query:** `?limit=50&status=&search=`
- **Response:** `{ "items": [ ... ] }`

## Core Definitions
**ScanResponse Schema Requirements**
- Frontend expects `compliance.findings` to be an array of rule evaluations.
- Frontend maps `finding.evidence[0].source_evidence.bbox` directly using relative `[L, T, R, B]`.
- Failure to provide `source_width` and `source_height` results in bounding box rendering failure.
