"""Pydantic schemas for package-image scans."""

from datetime import date, datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ScanStatus(str, Enum):
    """Lifecycle state of an ingested scan."""

    RECEIVED = "received"
    PENDING_FALLBACK = "pending_fallback"
    COMPLIANT = "compliant"
    VIOLATION = "violation"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"


class ImageQualityStatus(str, Enum):
    """Outcome of engineering checks for downstream processing readiness."""

    PASS = "PASS"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"


class DimensionsQualityCheck(BaseModel):
    """Measured dimensions and the configured minimum requirements."""

    passed: bool
    width: int
    height: int
    minimum_width: int
    minimum_height: int


class SharpnessQualityCheck(BaseModel):
    """Laplacian-variance sharpness measurement."""

    passed: bool
    laplacian_variance: float
    minimum_variance: float


class BrightnessQualityCheck(BaseModel):
    """Mean grayscale-intensity exposure measurement."""

    passed: bool
    mean_intensity: float
    minimum_intensity: float
    maximum_intensity: float


class ReadabilityQualityCheck(BaseModel):
    """Whether OpenCV could decode the validated image content."""

    passed: bool
    method: str


class ImageQualityChecks(BaseModel):
    """Deterministic quality checks performed on the uploaded image."""

    dimensions: DimensionsQualityCheck
    sharpness: SharpnessQualityCheck
    brightness: BrightnessQualityCheck
    readability: ReadabilityQualityCheck


class ImageQualityAssessment(BaseModel):
    """Explainable engineering assessment for future OCR preparation."""

    status: ImageQualityStatus
    checks: ImageQualityChecks
    messages: list[str]


class OcrStatus(str, Enum):
    """Outcome of an OCR attempt on a processed scan derivative."""

    COMPLETED = "completed"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    NO_TEXT = "no_text"
    FAILED = "failed"


class OCREngine(str, Enum):
    PADDLEOCR = "paddleocr"
    GOOGLE_MLKIT = "google_mlkit"
    APPLE_VISION = "apple_vision"
    GEMINI_VISION = "gemini_vision"
    YOLO = "yolo"

class OCRSource(str, Enum):
    PROCESSED = "processed"
    VISION = "vision"
    EDGE = "edge"


class EvidenceQuality(str, Enum):
    """Quality state of evidence independently from legal compliance."""

    PASS = "pass"
    REVIEW_REQUIRED = "review_required"
    FAILED = "failed"


class EvidenceVerificationStatus(str, Enum):
    """Verification state of a runtime evidence item."""

    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    REJECTED = "rejected"
    REVIEW_REQUIRED = "review_required"


class ImportedStatus(str, Enum):
    """Known origin status used by applicability decisions."""

    DOMESTIC = "DOMESTIC"
    IMPORTED = "IMPORTED"
    UNKNOWN = "UNKNOWN"


class PackageType(str, Enum):
    """Package/context classification used before legal evaluation."""

    RETAIL = "RETAIL"
    WHOLESALE = "WHOLESALE"
    EXPORT = "EXPORT"
    INDUSTRIAL = "INDUSTRIAL"
    INSTITUTIONAL = "INSTITUTIONAL"
    ADVERTISEMENT = "ADVERTISEMENT"
    UNKNOWN = "UNKNOWN"


class ApplicabilityStatus(str, Enum):
    """Result of asking whether a versioned rule applies."""

    APPLICABLE = "applicable"
    NOT_APPLICABLE = "not_applicable"
    UNKNOWN = "unknown"
    REVIEW_REQUIRED = "review_required"


class ProductContext(BaseModel):
    """Context facts used for applicability, never a compliance finding."""

    model_config = ConfigDict(extra="ignore")

    brand_name: str | None = None
    product_name: str | None = None
    manufacturer_name: str | None = None
    product_category: str | None = None
    product_subcategory: str | None = None
    imported_status: ImportedStatus = ImportedStatus.UNKNOWN
    package_type: PackageType = PackageType.UNKNOWN
    industrial_institutional: bool | None = None
    package_quantity: float | None = Field(default=None, gt=0)
    package_unit: str | None = None
    identification_confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class CanonicalEvidence(BaseModel):
    """Engine-neutral evidence contract for present and future adapters."""

    field: str
    value: float | str | None = None
    text: str | None = None
    bbox: tuple[float, float, float, float]
    source_image_id: str
    source_width: int = Field(gt=0)
    source_height: int = Field(gt=0)
    source_engine: OCREngine
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_quality: EvidenceQuality = EvidenceQuality.REVIEW_REQUIRED
    verification_status: EvidenceVerificationStatus = EvidenceVerificationStatus.UNVERIFIED
    provenance: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_bbox(self) -> "CanonicalEvidence":
        left, top, right, bottom = self.bbox
        if right <= left or bottom <= top:
            raise ValueError("bbox must be [left, top, right, bottom] with positive area")
        if left < 0 or top < 0 or right > self.source_width or bottom > self.source_height:
            raise ValueError("bbox must be within source image dimensions")
        if self.value is None and not self.text:
            raise ValueError("evidence must contain value or text")
        return self


class EdgeOcrElement(BaseModel):
    """One word/token element recognized natively within a text line."""
    text: str
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    bbox: tuple[float, float, float, float]


class EdgeOcrItem(BaseModel):
    """One text line or block recognized natively on the mobile device."""
    model_config = ConfigDict(extra="ignore")
    text: str
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    bbox: tuple[float, float, float, float]
    elements: list[EdgeOcrElement] = Field(default_factory=list)

class EdgeScanRequest(BaseModel):
    """A lightweight scan request from a mobile device without an image."""
    model_config = ConfigDict(extra="ignore")
    engine: OCREngine = OCREngine.GOOGLE_MLKIT
    source_width: int = 1920
    source_height: int = 1080
    items: list[EdgeOcrItem] = Field(default_factory=list)
    client_scan_id: str | None = None
    officer_id: str = "OFFICER-DEFAULT"
    is_offline_sync: bool = False
    client_timestamp: str | None = None
    sync_source: str | None = None
    context: ProductContext = Field(default_factory=ProductContext)


class OCRTextEvidence(BaseModel):
    """One OCR finding measured against the source image."""

    text: str
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: tuple[float, float, float, float]
    engine: OCREngine
    source: OCRSource
    source_image_id: str
    elements: list[EdgeOcrElement] = Field(default_factory=list)
    source_width: int | None = Field(default=None, gt=0, exclude=True)
    source_height: int | None = Field(default=None, gt=0, exclude=True)
    evidence_quality: EvidenceQuality = Field(default=EvidenceQuality.REVIEW_REQUIRED, exclude=True)
    verification_status: EvidenceVerificationStatus = Field(
        default=EvidenceVerificationStatus.UNVERIFIED,
        exclude=True,
    )
    provenance: dict[str, Any] = Field(default_factory=dict, exclude=True)
    extraction_method: str | None = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def validate_bbox(self) -> "OCRTextEvidence":
        """Require an axis-aligned left, top, right, bottom bounding box."""
        left, top, right, bottom = self.bbox
        if right <= left or bottom <= top:
            raise ValueError("bbox must be [left, top, right, bottom] with positive area")
        return self


class OCRResult(BaseModel):
    """Structured evidence from OCR without any compliance interpretation."""

    status: OcrStatus
    items: list[OCRTextEvidence]
    source_image_id: str
    source_width: int
    source_height: int
    error: str | None = None


class ExtractionStatus(str, Enum):
    """Outcome of the structured extraction process."""

    COMPLETED = "completed"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    FAILED = "failed"


class ExtractedField(BaseModel):
    """A single structured fact extracted from OCR evidence."""

    field_name: str
    value: float | str
    unit: str | None = None
    confidence: float
    source_evidence: OCRTextEvidence


class ExtractionResult(BaseModel):
    """The complete set of facts extracted from a scan."""

    status: ExtractionStatus
    fields: list[ExtractedField]


class ComplianceStatus(str, Enum):
    """Overall or rule-specific compliance outcome."""

    COMPLIANT = "compliant"
    VIOLATION = "violation"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    NOT_APPLICABLE = "not_applicable"


class ComplianceFinding(BaseModel):
    """Outcome of a single deterministic rule evaluation."""

    rule_id: str
    status: ComplianceStatus
    message: str
    legal_reference: str
    evidence: list[ExtractedField]
    inspector_disclaimer: str = Field(
        default="AI decision support screening. Authoritative enforcement decision belongs to the Legal Metrology Officer."
    )


class ComplianceResult(BaseModel):
    """The complete set of compliance findings for a scan."""

    status: ComplianceStatus
    findings: list[ComplianceFinding]


class InitialOcrTrace(BaseModel):
    """Trace of raw initial OCR detection for a field."""
    engine: str
    raw_text: str | None = None
    confidence: float | None = None
    bbox: list[float] | tuple[float, float, float, float] | None = None


class DeterministicExtractionTrace(BaseModel):
    """Trace of deterministic regex/rule extraction."""
    status: Literal["SUCCESS", "FAILED"]
    value: str | float | None = None
    reason: str | None = None


class GeminiFallbackTrace(BaseModel):
    """Trace of Gemini multimodal AI fallback for a field."""
    triggered: bool
    reason: str | None = None
    value: str | float | None = None
    confidence: float | None = None
    bbox: list[float] | tuple[float, float, float, float] | None = None


class EvidenceMergeTrace(BaseModel):
    """Trace of selected evidence after merging."""
    selected_source: str
    selected_value: str | float
    selected_bbox: list[float] | tuple[float, float, float, float]


class ComplianceTrace(BaseModel):
    """Trace of compliance validation for a field."""
    status: str
    rule_id: str | None = None
    message: str | None = None


class FrontendEvidenceTrace(BaseModel):
    """Trace of the evidence and bounding box displayed on the frontend."""
    displayed_from: str
    displayed_bbox: list[float] | tuple[float, float, float, float]


class FieldProvenance(BaseModel):
    """Complete provenance lifecycle for an extracted field."""
    field_name: str
    lifecycle_stage: Literal["DETECTED", "EXTRACTED", "RECOVERED", "MERGED", "VERIFIED"] = "DETECTED"
    initial_ocr: InitialOcrTrace
    deterministic_extraction: DeterministicExtractionTrace
    gemini_fallback: GeminiFallbackTrace
    evidence_merge: EvidenceMergeTrace
    compliance: ComplianceTrace
    frontend_evidence: FrontendEvidenceTrace


class ScanProvenance(BaseModel):
    """Comprehensive OCR provenance report for an entire scan."""
    fields: list[FieldProvenance]
    fallback_triggered: bool
    fallback_reasons: list[str]
    summary: dict[str, Any]


class InspectorDecisionType(str, Enum):
    """Enforcement outcome determined by the Legal Metrology Officer."""

    COMPLIANT = "compliant"
    VIOLATION = "violation"


class InspectorDecisionRequest(BaseModel):
    """Payload submitted by an officer to resolve a pending review item."""

    decision: InspectorDecisionType
    officer_id: str = "OFFICER-DEFAULT"
    notes: str | None = None


class InspectorDecisionRecord(BaseModel):
    """Auditable record of a human officer enforcement decision."""

    decision: InspectorDecisionType
    officer_id: str = "OFFICER-DEFAULT"
    notes: str | None = None
    decided_at: datetime = Field(default_factory=lambda: datetime.now())


class ScanCreateResponse(BaseModel):
    """Public metadata returned after a package image is ingested."""

    scan_id: str
    status: ScanStatus
    filename: str | None = None
    content_type: str | None = None
    file_size: int | None = None
    width: int
    height: int
    created_at: datetime
    quality: ImageQualityAssessment | None = None
    ocr: OCRResult
    extraction: ExtractionResult
    compliance: ComplianceResult
    provenance: ScanProvenance | None = None
    client_scan_id: str | None = None
    officer_id: str = "OFFICER-DEFAULT"
    inspector_decision: InspectorDecisionRecord | None = None
    context: ProductContext = Field(default_factory=ProductContext, exclude=True)
