# Legal Metrology Compliance Scanner — React Prototype

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

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
