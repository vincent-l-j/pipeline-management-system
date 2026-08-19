from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class ContactCreate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    linkedin: str | None = None
    notes: str | None = None
    organisation_ids: list[UUID] = Field(default_factory=list)
    relationship_owner_id: UUID | None = None


class ContactUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    linkedin: str | None = None
    notes: str | None = None
    # Omitted leaves the affiliations alone; supplied replaces the whole set, since
    # they are unordered and equal and there is no per-link identity to patch.
    organisation_ids: list[UUID] | None = None
    relationship_owner_id: UUID | None = None


class ContactOut(BaseModel):
    id: UUID
    first_name: str | None
    last_name: str | None
    email: str | None
    phone: str | None
    linkedin: str | None
    notes: str | None
    organisation_ids: list[UUID]
    relationship_owner_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
