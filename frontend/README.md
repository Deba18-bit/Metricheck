# Legal Metrology Compliance Scanner — React Prototype

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Deploy to Vercel

Set the Vercel project **Root Directory** to `frontend`, then use the
following build settings:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm ci`

Add `VITE_API_BASE_URL` as a Vercel environment variable for Preview and
Production, pointing to the deployed FastAPI base URL (without a trailing
slash), for example `https://api.example.com`. Local development falls back
to `http://localhost:8000`.

## Included demo flow

1. Landing / Scan page
2. Camera or package-image upload
3. Drag-and-drop upload
4. Explicit processing pipeline:
   Image received → Image quality check → OCR scanning → Extracting declarations → Checking Legal Metrology rules → Generating compliance report
5. Compliance result dashboard
6. Rule-by-rule findings
7. Package evidence viewer with OCR-style bounding boxes
8. Click a finding to highlight its evidence box
9. Explainability / “Why was this result produced?” panel
10. New scan and print/export report action

The demo currently uses frontend mock findings so the UI can be demonstrated without a backend. Replace the `checks` array and `processFile()` flow with your `ScanResponse` API response when the backend is ready.
