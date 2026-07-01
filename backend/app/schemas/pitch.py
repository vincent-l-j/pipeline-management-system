from pydantic import BaseModel
from uuid import UUID
from datetime import date, datetime
from app.models.pitch import PipelineStage, PitchSource, FundingPathway


class PitchCreate(BaseModel):
    title: str
    short_description: str | None = None
    submission_date: date | None = None
    source: PitchSource | None = None
    current_stage: PipelineStage = PipelineStage.RECEIVED
    domain_tags: str | None = None
    funding_pathway: FundingPathway | None = None
    masterplan_alignment: str | None = None
    is_confidential: bool = False
    organisation_id: UUID | None = None
    lead_id: UUID | None = None


class PitchUpdate(BaseModel):
    # Audit invariant: current_stage is intentionally NOT settable here. Stage
    # changes must go through POST /pitches/{id}/stage so every transition writes
    # a PitchStageHistory row. Do not widen this schema to include current_stage.
    title: str | None = None
    short_description: str | None = None
    source: PitchSource | None = None
    domain_tags: str | None = None
    funding_pathway: FundingPathway | None = None
    masterplan_alignment: str | None = None
    is_confidential: bool | None = None
    organisation_id: UUID | None = None
    lead_id: UUID | None = None


class PitchStageUpdate(BaseModel):
    new_stage: PipelineStage
    note: str | None = None


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
    current_stage: PipelineStage
    domain_tags: str | None
    funding_pathway: FundingPathway | None
    masterplan_alignment: str | None
    is_confidential: bool
    organisation_id: UUID | None
    lead_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PitchFileLinkCreate(BaseModel):
    file_path: str
    label: str | None = None
    description: str | None = None


class PitchFileLinkOut(BaseModel):
    id: UUID
    pitch_id: UUID
    file_path: str
    label: str | None
    description: str | None

    model_config = {"from_attributes": True}
