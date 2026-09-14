"""Definitions for the compliance rule framework."""

from dataclasses import dataclass
from datetime import date
from typing import Protocol

from app.schemas.scans import ApplicabilityStatus, ExtractionResult, ComplianceFinding


class RuleVersionStatus(str):
    """Stable lifecycle values for legal rule versions."""

    CURRENT = "current"
    SUPERSEDED = "superseded"
    UNVERIFIED = "unverified"

@dataclass(frozen=True)
class RuleDefinition:
    """A versioned legal rule and its applicability metadata."""
    
    rule_id: str
    title: str
    legal_reference: str
    applicability: str
    description: str
    validation_type: str
    severity: str
    effective_date: str | None
    evidence_requirement: str
    rule_name: str | None = None
    legal_source: str | None = None
    amendment_version: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    status: str = RuleVersionStatus.UNVERIFIED
    applicability_conditions: dict[str, object] | None = None
    requirement_type: str | None = None

    @property
    def canonical_name(self) -> str:
        """Return the stable human-readable rule name."""
        return self.rule_name or self.title

    def is_effective_on(self, inspection_date: date) -> bool:
        """Return whether this version is effective on a given date."""
        start = self.effective_from
        if start is None and self.effective_date:
            start = date.fromisoformat(self.effective_date)
        if start and inspection_date < start:
            return False
        return not self.effective_to or inspection_date <= self.effective_to


class RuleValidator(Protocol):
    """Protocol for rule evaluation."""
    
    def evaluate(self, rule: RuleDefinition, extraction: ExtractionResult) -> ComplianceFinding:
        """Evaluate a rule against extracted evidence."""
        ...


@dataclass(frozen=True)
class RuleApplicability:
    """A rule applicability decision separate from compliance evaluation."""

    rule_id: str
    status: ApplicabilityStatus
    reason: str
    rule_version: str | None = None
