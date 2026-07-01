from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    display_name: str
    role: UserRole = UserRole.VIEWER


class UserUpdate(BaseModel):
    display_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserDirectoryOut(BaseModel):
    """Minimal name-resolution shape for any authenticated user. Deliberately
    excludes email, role, is_active and azure_oid so low-privilege callers can
    resolve display names without seeing the sensitive staff directory."""
    id: UUID
    display_name: str

    model_config = {"from_attributes": True}
