# Rule Engine Architecture

The Compliance Engine is a deterministic mapping system that crosses product contextual states with LMPC clauses.

## 1. Rule Applicability
Determined before rules run. Combines:
- **Product Category** (e.g., Food, Electronics)
- **Package Type** (e.g., Multi-piece, Wholesale)
- **Imported/Export Status** (Rule limits vary heavily on `DOMESTIC` vs `IMPORTED`).
- **Exemptions** (e.g., < 10g or > 25kg packages).

## 2. Deterministic Evaluation
Each applicable rule evaluates against the extracted `Evidence` array.
- **Rule Versions:** Tracks which year's LMPC amendment applies based on date of manufacture.
- **Evaluation Loop:** For each required field (e.g., `MRP`), the engine checks the Evidence array. If missing, status becomes `VIOLATION`. If present but malformed, status becomes `MANUAL_REVIEW_REQUIRED`.

## 3. Evaluation States
- `COMPLIANT`: Found, cleanly parsed, matches legal formatting.
- `NON_COMPLIANT` / `VIOLATION`: Explicitly missing or explicitly violating a constraint.
- `MANUAL_REVIEW_REQUIRED`: AI uncertainty, unparseable data, or conflicting multi-engine predictions. Requires Inspector UI intervention.
