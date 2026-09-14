from datetime import date

import pytest
from pydantic import ValidationError

from app.rules.applicability import ApplicabilityService
from app.rules.definitions import RuleDefinition
from app.schemas.scans import (
    ApplicabilityStatus,
    CanonicalEvidence,
    EvidenceQuality,
    EvidenceVerificationStatus,
    ImportedStatus,
    OCREngine,
    PackageType,
    ProductContext,
)


def make_rule(**kwargs) -> RuleDefinition:
    defaults = {
        "rule_id": "TEST-1",
        "title": "Test declaration",
        "legal_reference": "Test source",
        "applicability": "context-dependent",
        "description": "Test",
        "validation_type": "presence_check",
        "severity": "high",
        "effective_date": None,
        "evidence_requirement": "text",
        "rule_name": "Test declaration",
        "legal_source": "Test source",
        "amendment_version": "v1",
        "effective_from": date(2025, 1, 1),
        "status": "current",
    }
    defaults.update(kwargs)
    return RuleDefinition(**defaults)


def test_rule_version_effective_date_boundaries():
    rule = make_rule(effective_to=date(2025, 12, 31))
    assert rule.is_effective_on(date(2025, 1, 1))
    assert rule.is_effective_on(date(2025, 12, 31))
    assert not rule.is_effective_on(date(2024, 12, 31))
    assert not rule.is_effective_on(date(2026, 1, 1))


def test_applicability_distinguishes_unknown_and_not_applicable():
    service = ApplicabilityService()
    rule = make_rule(
        applicability_conditions={"package_types": ["RETAIL"]},
    )
    unknown = service.evaluate(rule, ProductContext())
    export = service.evaluate(rule, ProductContext(package_type=PackageType.EXPORT))
    retail = service.evaluate(rule, ProductContext(package_type=PackageType.RETAIL))
    assert unknown.status == ApplicabilityStatus.UNKNOWN
    assert export.status == ApplicabilityStatus.NOT_APPLICABLE
    assert retail.status == ApplicabilityStatus.APPLICABLE


def test_import_and_category_context_are_explicit():
    service = ApplicabilityService()
    rule = make_rule(
        applicability_conditions={"requires_imported": True, "requires_category": True},
    )
    assert service.evaluate(rule, ProductContext()).status == ApplicabilityStatus.UNKNOWN
    result = service.evaluate(
        rule,
        ProductContext(
            imported_status=ImportedStatus.IMPORTED,
            product_category="FOOD",
        ),
    )
    assert result.status == ApplicabilityStatus.APPLICABLE


def test_unverified_rule_requires_review():
    result = ApplicabilityService().evaluate(
        make_rule(status="unverified"),
        ProductContext(package_type=PackageType.RETAIL),
    )
    assert result.status == ApplicabilityStatus.REVIEW_REQUIRED


def test_canonical_evidence_validates_dimensions_and_future_engines():
    evidence = CanonicalEvidence(
        field="mrp",
        value=150.0,
        text="MRP Rs. 150",
        bbox=(10, 20, 100, 60),
        source_image_id="scan:test",
        source_width=200,
        source_height=100,
        source_engine=OCREngine.GEMINI_VISION,
        confidence=0.91,
        evidence_quality=EvidenceQuality.PASS,
        verification_status=EvidenceVerificationStatus.UNVERIFIED,
        provenance={"model": "bootstrap"},
    )
    assert evidence.source_engine == OCREngine.GEMINI_VISION
    with pytest.raises(ValidationError):
        CanonicalEvidence(
            field="mrp",
            text="MRP",
            bbox=(0, 0, 201, 20),
            source_image_id="scan:test",
            source_width=200,
            source_height=100,
            source_engine=OCREngine.PADDLEOCR,
            confidence=0.9,
        )


def test_product_context_does_not_conflate_identity_roles():
    context = ProductContext(
        brand_name="Brand",
        product_name="Common name",
        manufacturer_name="Manufacturer",
        product_category="FOOD",
        identification_confidence=0.8,
    )
    assert context.brand_name != context.product_name
    assert context.product_name != context.manufacturer_name
    assert context.imported_status == ImportedStatus.UNKNOWN
    assert context.package_type == PackageType.UNKNOWN
