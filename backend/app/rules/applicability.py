"""Deterministic rule applicability decisions."""

from datetime import date
from collections.abc import Iterable

from app.rules.definitions import RuleApplicability, RuleDefinition, RuleVersionStatus
from app.schemas.scans import ApplicabilityStatus, ImportedStatus, PackageType, ProductContext


class ApplicabilityService:
    """Select rules without conflating scope with compliance."""

    def evaluate(
        self,
        rule: RuleDefinition,
        context: ProductContext,
        inspection_date: date | None = None,
    ) -> RuleApplicability:
        """Evaluate known context facts for one versioned rule."""
        if rule.status == RuleVersionStatus.UNVERIFIED:
            return RuleApplicability(
                rule.rule_id,
                ApplicabilityStatus.REVIEW_REQUIRED,
                "Legal source or rule version is not verified.",
                rule.amendment_version,
            )

        if inspection_date and not rule.is_effective_on(inspection_date):
            return RuleApplicability(
                rule.rule_id,
                ApplicabilityStatus.NOT_APPLICABLE,
                "Rule version is not effective on the inspection date.",
                rule.amendment_version,
            )

        conditions = rule.applicability_conditions or {}
        allowed_package_types = conditions.get("package_types")
        if allowed_package_types and context.package_type == PackageType.UNKNOWN:
            return RuleApplicability(
                rule.rule_id,
                ApplicabilityStatus.UNKNOWN,
                "Package type is unknown.",
                rule.amendment_version,
            )
        if allowed_package_types and context.package_type.value not in allowed_package_types:
            return RuleApplicability(
                rule.rule_id,
                ApplicabilityStatus.NOT_APPLICABLE,
                "Package type does not match the rule conditions.",
                rule.amendment_version,
            )

        if conditions.get("requires_imported") is True:
            if context.imported_status == ImportedStatus.UNKNOWN:
                return RuleApplicability(
                    rule.rule_id,
                    ApplicabilityStatus.UNKNOWN,
                    "Imported status is unknown.",
                    rule.amendment_version,
                )
            if context.imported_status != ImportedStatus.IMPORTED:
                return RuleApplicability(
                    rule.rule_id,
                    ApplicabilityStatus.NOT_APPLICABLE,
                    "Rule condition requires an imported package.",
                    rule.amendment_version,
                )

        if conditions.get("requires_category") and not context.product_category:
            return RuleApplicability(
                rule.rule_id,
                ApplicabilityStatus.UNKNOWN,
                "Product category is unknown.",
                rule.amendment_version,
            )

        if context.package_type == PackageType.UNKNOWN and conditions.get("requires_known_package_type"):
            return RuleApplicability(
                rule.rule_id,
                ApplicabilityStatus.UNKNOWN,
                "Package type is unknown.",
                rule.amendment_version,
            )

        return RuleApplicability(
            rule.rule_id,
            ApplicabilityStatus.APPLICABLE,
            "Known context satisfies the rule applicability conditions.",
            rule.amendment_version,
        )

    def evaluate_set(
        self,
        rules: Iterable[RuleDefinition],
        context: ProductContext,
        inspection_date: date | None = None,
    ) -> list[RuleApplicability]:
        """Evaluate a registry snapshot without evaluating compliance."""
        return [self.evaluate(rule, context, inspection_date) for rule in rules]
