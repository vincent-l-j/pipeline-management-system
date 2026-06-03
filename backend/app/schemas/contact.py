from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import date, datetime


class ContactCreate(BaseModel):
    name: str
    role: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    linkedin: str | None = None
    notes: str | None = None
    last_contacted: date | None = None
    organisation_id: UUID | None = None
    relationship_owner_id: UUID | None = None


class ContactUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    linkedin: str | None = None
    notes: str | None = None
    last_contacted: date | None = None
    organisation_id: UUID | None = None
    relationship_owner_id: UUID | None = None


class ContactOut(BaseModel):
    id: UUID
    name: str
    role: str | None
    email: str | None
    phone: str | None
    linkedin: str | None
    notes: str | None
    last_contacted: date | None
    organisation_id: UUID | None
    relationship_owner_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
