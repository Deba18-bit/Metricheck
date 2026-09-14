METRICHECK • SIH 2026 • Page 1
METRICHECK
AI-Powered, Evidence-Driven Automated Inspection for Legal Metrology Compliance
SIH 2026 — Problem Statement 26034
“From Visuals to Verified Compliance.”
Core thesis: Automate repetitive packaged-commodity inspection by converting package visuals into structured
evidence, verifying evidence across sources, applying applicable Legal Metrology requirements deterministically,
prioritizing exceptions, and preserving an auditable inspector decision layer.
1. Executive Overview
METRICHECK combines computer vision, OCR, barcode/GTIN processing, commodity classification, structured evidence extraction,
evidence verification, selective Gemini multimodal recovery, deterministic Legal Metrology rules, physical measurement, offline
synchronization, centralized history, risk prioritization and inspector workflow.
Architecture principle: local models handle routine perception first. Gemini Vision is invoked only for missing, ambiguous,
conflicting, degraded or semantically difficult evidence, and its validated hard-case examples feed a controlled learning pipeline.
Authority: the system automates inspection work and produces assessments; the inspector remains the final legal decision-maker.
2. End-to-End Architecture
Package → Smart Camera/OpenCV → YOLO11n → Region Crops → OCR/Barcode → YOLO11n-cls + GTIN/OCR
Classification → Central Evidence Bridge → Evidence Sufficiency Gate → Selective Gemini Recovery → Cross-Source
Verification → Trusted/Physical Evidence → Applicability Engine → Versioned LMPC Rule Engine → Automated
Assessment → Risk Prioritization → Inspector Command Center → Final Human Decision → Audit Record.
Human intervention is not the routine path. High-confidence cases proceed automatically; intervention is reserved for genuine
exceptions, corrections and accountable final decisions.
3. Smart Capture & Input
• OpenCV capture/preprocessing; blur, glare, pose and framing quality gates.
• Real-time Inspector Guidance: “Move closer”, “Tilt to reduce glare”, “Hold steady”.
• Inspection Coverage verifies that required package evidence has been captured.
• Poor frames are rejected/guided before they become downstream evidence.
4. Local Perception Layer
YOLO11n (Ultralytics Nano Detector) performs local semantic-region detection and bounding-box generation.
Nine regions: PDP; MRP_BLOCK; NET_QTY_BLOCK; DATE_BLOCK; MANUFACTURER_BLOCK; CONSUMER_CARE_BLOCK;
COUNTRY_OF_ORIGIN_BLOCK; REGULATORY_LOGOS; BARCODE_REGION.
OCR: PaddleOCR / Google ML Kit reads relevant YOLO-generated crops. Barcode: PyZBar / ZXing-Cpp isolates
BARCODE_REGION and decodes GTIN, with grayscale fallback.
Perception preserves raw text, confidence, source image and original-image coordinates for evidence provenance.
5. Product Classification
Tier 1: GTIN/master-data lookup. Tier 2: YOLO11n-cls. Tier 3: Gemini teacher escalation when local confidence is insufficient;
validated outputs enter the learning queue.
Eight macro classes: FOOD_BEVERAGE; COSMETICS_PERSONAL_CARE; ELECTRONICS_APPLIANCES;
PHARMACEUTICALS_MEDICAL; APPAREL_TEXTILES_FOOTWEAR; HOUSEHOLD_CLEANING_FMCG;
HARDWARE_AUTOMOTIVE; GENERAL_PACKAGED_GOODS.
Classification selects the regulatory profile; it does not itself make the legal decision.
6. Central Evidence Bridge
• Entity parsing and structured field extraction.
• Context-aware character correction only when field context makes it safe; original OCR is preserved.
• MRP, quantity and date normalization; standard units for g, kg, ml, L and count.
• Derived Unit Sale Price calculation where applicable.
METRICHECK • SIH 2026 • Page 2
• Format/math validation, OCR confidence, temporal/multi-frame voting, spatial consistency and GTIN cross-checks.
• Completeness/confidence scoring; hard conflicts cannot be overridden merely by a high score.
7. Evidence Sufficiency Gate & Selective Gemini
SUFFICIENT → deterministic path. MISSING / AMBIGUOUS / CONFLICTING / DEGRADED → Gemini Vision → recovered
evidence → verification.
• Gemini receives the full image and/or targeted crops.
• It supplies recovery evidence and teacher examples; it is not the permanent processing engine.
• Validated hard cases enter a curated training queue.
• The long-term objective is local-model improvement and decreasing Gemini/API dependency.
8. Trusted Data & Automated Physical Measurement
GTIN / trusted product data: identity and attribute cross-check when available.
Scale: actual mass measurement; compare against declared quantity and the applicable tolerance/requirement.
Digital caliper: physical dimension measurement where relevant.
Depth/AR + OCR — planned font-size verification: depth/AR supplies metric spatial information while OCR identifies declaration
text. The system estimates physical text dimensions, incorporates calibration and measurement uncertainty, and automatically
evaluates the applicable Rule 7 requirement.
Automation: measurement uncertainty is quantified; valid PASS/FAIL results remain automated. Only genuinely invalid/unusable
measurements should cause recapture or exception handling.
9. Applicability Engine
Maps commodity/package context, regulatory profile and applicable exceptions to the requirements that should actually be
evaluated. This prevents every declaration from being treated as universally applicable.
10. Versioned LMPC Rule Engine
Explicit, testable and versioned requirements allow amendments to be introduced without rewriting perception.
System assessment: COMPLIANT / REVIEW_REQUIRED / POTENTIAL_VIOLATION. Inspector state: PENDING /
CONFIRMED_COMPLIANT / CONFIRMED_VIOLATION / MANUAL_REVIEW.
LLM outputs cannot directly mutate statutory rules or final decisions. Legal evaluation remains deterministic and versioned.
11. Automated Assessment & Risk Prioritization
• Routine high-confidence cases are automatically assessed.
• LOW: high-confidence routine result.
• REVIEW: unresolved uncertainty, incomplete evidence or invalid measurement.
• HIGH: strong potential-violation evidence or significant conflict.
• Batch extension: thousands of packages can be screened locally, with uncertain/high-risk cases prioritized.
12. Inspector Command Center
Dashboard, evidence viewer, compliance summary, rule details, report, history and targeted correction tools. The inspector does not
manually repeat every automated inspection.
Decision: Confirm Compliant / Confirm Violation / Manual Review. Decision notes and timestamp are persisted separately from the
system assessment.
13. Offline-First Architecture
Capture → local SQLite/storage → pending queue → network check → encrypted sync → FastAPI → PostgreSQL.
Web, Android and iOS converge on the same central scan/history model. Offline capture remains usable without connectivity; a
queued scan is not represented as a final processed statutory assessment until processing completes.
14. Web, Android, iOS & Backend
• React/Vite: upload/capture, dashboard, evidence viewer, report and history.
• Android: Google ML Kit Text Recognition V2, offline queue and backend/Gemini escalation.
METRICHECK • SIH 2026 • Page 3
• iOS: Apple Vision text recognition path with the same backend contract.
• FastAPI: orchestration, processing APIs, synchronization and persistence.
• Development integration: FastAPI 8001; Vite 5173; /api proxy → 127.0.0.1:8001.
15. Evidence Provenance & Bounding Boxes
For each critical field: initial source, raw text, confidence, bbox, deterministic extraction, Gemini trigger/reason, merge selection,
compliance rule and frontend-displayed evidence.
BBox contract: [left, top, right, bottom] in original image coordinates. Frontend percentage mapping uses original source
width/height, never viewport dimensions.
Missing evidence/bbox must never crash the UI. Displayed evidence boxes must come from actual source evidence and are never
artificially shrunk.
16. Database, Storage & Infrastructure
• PostgreSQL: scans, identity, compliance, provenance, inspector decisions and metadata.
• SQLite/local queue: mobile offline state and pending synchronization.
• File storage: package images, evidence artifacts, datasets and model artifacts.
• Redis: optional caching/queue acceleration.
• Versioned model storage for YOLO11n, YOLO11n-cls and future OCR/model releases.
• Docker; existing Vercel/Render deployment paths.
17. Gemini Teacher & Local Learning Flywheel
Hard/uncertain cases → Gemini recovery/teacher → curated annotation queue → quality control → curated dataset →
periodic training/fine-tuning → benchmark → versioned release → stronger local perception.
Gemini does not directly retrain YOLO on every scan. It supplies teacher/recovery examples; validated samples are used through
standard training workflows.
Cost-decay objective: stronger local models solve more difficult cases locally, reducing future Gemini calls and external API cost.
18. Human-in-the-Loop Learning
• Humans do not manually inspect every product.
• Intervention is targeted to correction, uncertainty, annotation and final accountable decisions.
• Corrections may include bbox adjustment, label correction and additional annotation.
• Only validated data enters training.
• Models are benchmarked and versioned before production release.
• The loop can improve YOLO11n, YOLO11n-cls and OCR.
19. Inspector Report & Audit Workflow
Inspection History → Inspect Report → Package Identity → Compliance Summary → Evidence/BBoxes → Rule Details →
Inspector Decision → Audit Record.
System assessment and inspector decision remain separate, preserving accountability and traceability.
20. Security & Engineering
• JWT-protected workflows; bcrypt password hashing; rate limiting.
• Upload validation, anti-enumeration controls and secure credential handling.
• LLM outputs cannot directly change statutory rules or final decisions.
• Models, evidence and rules are versioned for reproducibility.
• Inspection records are audit-aware rather than silently overwritten.
21. Verified Prototype Results
• Backend test suite: 74/74 passing after tabular Mfg/Exp alignment fix.
• Offline scenario tested with phone and Mac connectivity unavailable; queued data synchronized and processed without crashes.
METRICHECK • SIH 2026 • Page 4
• Inspector Report + Decision Workflow implemented and verified.
• One-to-one greedy row alignment fixed manufacturing/expiry association confusion; date delimiters normalized.
• Field-level provenance supports OCR → extraction → fallback → merge → compliance → frontend evidence tracing.
22. Performance Benchmark
Representative measured scan: upload 0.015 s; image quality 0.010 s; preprocessing 0.042 s; OCR 17.772 s; deterministic
extraction 0.001 s; AI fallback 3.432 s; total 21.271 s.
Environment-specific measurement only; it is not a universal latency guarantee. The architecture emphasizes lightweight local
processing and selective cloud escalation.
23. National-Level Differentiators
• India-specific LMPC intelligence: applicability + domain-specific rule engine.
• Evidence-driven: result tied to text, region, bbox, source and rule.
• Hybrid AI: local YOLO/OCR/classification first; Gemini only when necessary.
• Automated physical verification: scale/caliper and planned Depth/AR + OCR measurement.
• Offline-first field operation.
• Central PostgreSQL audit/history and inspector workflow.
• Adaptive learning: hard cases strengthen local models and reduce cloud dependence.
• Automated inspection with final human legal authority.
24. Judge-Ready Answers
Question Answer
Is this just OCR? No. OCR is one perception component inside a complete evidence-to-decision pipeline.
Why Gemini? To recover difficult evidence selectively and provide teacher examples, not to process every package.
Who trains the local models? Validated Gemini-assisted examples are curated into a dataset and used for periodic local-model
training/fine-tuning.
Does a human inspect every product? No. Routine high-confidence inspection is automated; humans handle genuine exceptions/corrections and
final accountable decisions.
Can a camera weigh a package? No. A calibrated scale measures actual mass; the camera reads the declared quantity.
How is font size verified? Planned Depth/AR + OCR estimates physical text dimensions, incorporates calibration/uncertainty and
automatically evaluates the applicable requirement.
What happens offline? The device queues data locally and synchronizes when connectivity returns.
Can AI declare a violation? The system can produce a potential-violation assessment; the inspector retains final legal authority.
25. Final Technical Vision
METRICHECK evolves into an AI-driven automated inspection system: capture → understand → verify → recover → measure →
validate → prioritize → report → decide → learn.
The local layer becomes stronger through curated training data. Gemini becomes an escalation/teacher rather than a permanent
dependency. Physical properties are measured with appropriate instruments or depth-aware methods. The legal engine remains
deterministic and versioned. The inspector remains the accountable decision-maker.
Final positioning: “METRICHECK is an evidence-driven, India-focused Legal Metrology inspection platform that
combines local computer vision, OCR, selective multimodal AI, deterministic legal intelligence, automated physical
verification, offline-first operation, adaptive learning and an auditable inspector workflow.”
Appendix A — Core Technology Stack
OpenCV | YOLO11n | YOLO11n-cls | PaddleOCR / Google ML Kit | PyZBar / ZXing-Cpp | Gemini Vision | Python + FastAPI |
PostgreSQL | SQLite/local queue | Redis | React + Vite | Android/iOS | Docker | Vercel/Render.
Appendix B — Core Engineering Principles
• Perception is not truth.
• Evidence must be traceable.
• Local processing comes first.
METRICHECK • SIH 2026 • Page 5
• Cloud AI is selective.
• Legal rules remain deterministic and versioned.
• Physical quantities require appropriate physical measurement.
• Measurement uncertainty is quantified rather than making every case manual.
• Human corrections are curated before training.
• Inspector authority is separate from AI assessment.
• Offline operation is first-class.
• Implemented and planned capabilities are explicitly distinguished.