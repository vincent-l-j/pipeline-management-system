from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.models.organisation import OrgType


class OrganisationCreate(BaseModel):
    name: str
    org_type: OrgType | None = None
    sector: str | None = None
    state_territory: str | None = None
    website: str | None = None
    abn: str | None = None
    notes: str | None = None


class OrganisationUpdate(BaseModel):
    name: str | None = None
    org_type: OrgType | None = None
    sector: str | None = None
    state_territory: str | None = None
    website: str | None = None
    abn: str | None = None
    notes: str | None = None


class OrganisationOut(BaseModel):
    id: UUID
    name: str
    org_type: OrgType | None
    sector: str | None
    state_territory: str | None
    website: str | None
    abn: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
