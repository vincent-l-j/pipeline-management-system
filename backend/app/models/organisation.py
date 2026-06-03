"""Organisations that submit pitches or are linked to contacts."""

from sqlalchemy import String, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
import uuid

from app.models.base import Base, TimestampMixin


class OrgType(str, enum.Enum):
    STARTUP = "startup"
    UNIVERSITY = "university"
    NGO = "ngo"
    GOVERNMENT = "government"
    CONSORTIUM = "consortium"
    RESEARCH_CENTRE = "research_centre"
    OTHER = "other"


class Organisation(Base, TimestampMixin):
    __tablename__ = "organisations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), index=True)
    org_type: Mapped[OrgType | None] = mapped_column(SAEnum(OrgType))
    sector: Mapped[str | None] = mapped_column(String(255))
    state_territory: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(500))
    abn: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)

    # Relationships
    contacts = relationship("Contact", back_populates="organisation")
    pitches = relationship("Pitch", back_populates="organisation")
