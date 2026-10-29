from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.assessment import DeclineReason
from app.models.pitch import (
    RETIRED_STAGES,
    FundingPathway,
    PipelineStage,
    PitchSource,
    RequestType,
)


def _refuse_retired(stage: PipelineStage) -> PipelineStage:
    if stage in RETIRED_STAGES:
        raise ValueError(f"The {stage.value} stage is retired; choose another stage")
    return stage


class PitchCreate(BaseModel):
    title: str
    short_description: str | None = None
    submission_date: date | None = None
    source: PitchSource | None = None
    request_type: RequestType | None = None
    current_stage: PipelineStage = PipelineStage.INITIAL_SCREEN
    domain_tags: str | None = None
    funding_pathway: FundingPathway | None = None
    masterplan_alignment: str | None = None
    next_step: str | None = None
    is_confidential: bool = False
    organisation_id: UUID | None = None
    lead_id: UUID | None = None
    contact_ids: list[UUID] = Field(default_factory=list)

    _current_stage_not_retired = field_validator("current_stage")(_refuse_retired)


class PitchUpdate(BaseModel):
    # Audit invariant: current_stage is intentionally NOT settable here. Stage
    # changes must go through POST /pitches/{id}/stage so every transition writes
    # a PitchStageHistory row. Do not widen this schema to include current_stage.
    title: str | None = None
    short_description: str | None = None
    submission_date: date | None = None
    source: PitchSource | None = None
    request_type: RequestType | None = None
    domain_tags: str | None = None
    funding_pathway: FundingPathway | None = None
    masterplan_alignment: str | None = None
    next_step: str | None = None
    is_confidential: bool | None = None
    organisation_id: UUID | None = None
    lead_id: UUID | None = None
    # Omitted leaves the linked contacts alone; supplied replaces the whole set,
    # since they are unordered and equal with no per-link identity to patch.
    contact_ids: list[UUID] | None = None


class PitchStageUpdate(BaseModel):
    new_stage: PipelineStage
    note: str | None = None

    _new_stage_not_retired = field_validator("new_stage")(_refuse_retired)


class StageHistoryOut(BaseModel):
    id: UUID
    from_stage: PipelineStage | None
    to_stage: PipelineStage
    changed_at: datetime
    changed_by_id: UUID | None
    note: str | None

    model_config = {"from_attributes": True}


class PitchOut(BaseModel):
    id: UUID
    title: str
    short_description: str | None
    submission_date: date | None
    source: PitchSource | None
    request_type: RequestType | None
    current_stage: PipelineStage
    domain_tags: str | None
    funding_pathway: FundingPathway | None
    masterplan_alignment: str | None
    next_step: str | None
    is_confidential: bool
    organisation_id: UUID | None
    lead_id: UUID | None
    contact_ids: list[UUID]
    created_at: datetime
    # Read-only and derived: the reason recorded on the pitch's latest assessment,
    # and only once the pitch is actually in the declined stage. Absent from
    # PitchCreate and PitchUpdate on purpose — a client cannot set it, so the
    # pitch and its assessments can never disagree about why it was declined.
    decline_reason: DeclineReason | None = None

    model_config = {"from_attributes": True}
