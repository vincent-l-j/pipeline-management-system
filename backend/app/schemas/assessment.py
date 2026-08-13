from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator

from app.models.assessment import DeclineReason, Recommendation


class AssessmentCreate(BaseModel):
    national_impact: int
    translation_readiness: int
    team_capability: int
    ecosystem_fit: int
    funding_pathway_clarity: int
    masterplan_alignment: int
    recommendation: Recommendation
    decline_reason: DeclineReason | None = None
    rationale: str | None = None
    assessment_date: date
    pitch_id: UUID

    @model_validator(mode="after")
    def reason_requires_a_decline(self) -> "AssessmentCreate":
        """A reason only means something alongside a decline.

        Accepting one on a Proceed would store a contradiction that the pitch view
        would then have to decide how to interpret. Note the asymmetry: a decline
        *without* a reason stays valid, because the reason is optional.
        """
        if self.decline_reason is not None and self.recommendation != Recommendation.DECLINE:
            raise ValueError("decline_reason is only valid when recommendation is 'decline'")
        return self

    @field_validator(
        "national_impact",
        "translation_readiness",
        "team_capability",
        "ecosystem_fit",
        "funding_pathway_clarity",
        "masterplan_alignment",
    )
    @classmethod
    def score_must_be_1_to_5(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Score must be between 1 and 5")
        return v


class AssessmentOut(BaseModel):
    id: UUID
    national_impact: int
    translation_readiness: int
    team_capability: int
    ecosystem_fit: int
    funding_pathway_clarity: int
    masterplan_alignment: int
    recommendation: Recommendation
    decline_reason: DeclineReason | None
    rationale: str | None
    assessment_date: date
    version: int
    pitch_id: UUID
    assessor_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
