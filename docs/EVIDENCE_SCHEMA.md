# Canonical Evidence Schema

The `Evidence` object is the root source of truth tracking exactly how and where an attribute was detected.

```json
{
  "field": "MRP",
  "value": "150.00",
  "raw_ocr_text": "MRP Rs 150.00 (incl of all taxes)",
  "bbox": [104, 250, 420, 290],
  "source_image": "img_003.jpg",
  "source_engine": "gemini-flash-latest",
  "confidence": 0.98,
  "evidence_quality": "HIGH",
  "provenance": "SELECTIVE_FALLBACK",
  "verification_status": "PENDING_INSPECTOR"
}
```

## Field Definitions
- **field**: The specific LMPC target class (e.g., `NET_QUANTITY`, `MRP`).
- **value**: The parsed, structured representation.
- **raw_ocr_text**: The exact string observed by the perceptual engine.
- **bbox**: `[left, top, right, bottom]` absolute pixel bounds relative to source image.
- **source_engine**: Differentiates between `edge-mlkit`, `yolo-v8`, or `gemini-teacher`.
- **confidence**: 0.0 to 1.0 probability of correctness.
- **verification_status**: Determines if the data is raw, automatically accepted, or explicitly confirmed by an inspector.
