from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import date, datetime
from app.models.assessment import Recommendation


class AssessmentCreate(BaseModel):
    national_impact: int
    translation_readiness: int
    team_capability: int
    ecosystem_fit: int
    funding_pathway_clarity: int
    masterplan_alignment: int
    recommendation: Recommendation
    rationale: str | None = None
    assessment_date: date
    pitch_id: UUID

    @field_validator(
        "national_impact", "translation_readiness", "team_capability",
        "ecosystem_fit", "funding_pathway_clarity", "masterplan_alignment"
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
    rationale: str | None
    assessment_date: date
    version: int
    pitch_id: UUID
    assessor_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
