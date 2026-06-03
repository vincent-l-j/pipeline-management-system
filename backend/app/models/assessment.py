"""Assessments — scoring cards linked to pitches."""

from sqlalchemy import String, Text, Integer, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
import enum
import uuid

from app.models.base import Base, TimestampMixin


class Recommendation(str, enum.Enum):
    PROCEED = "proceed"
    PARK = "park"
    DECLINE = "decline"


class Assessment(Base, TimestampMixin):
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Scores — all 1 to 5
    national_impact: Mapped[int] = mapped_column(Integer)
    translation_readiness: Mapped[int] = mapped_column(Integer)
    team_capability: Mapped[int] = mapped_column(Integer)
    ecosystem_fit: Mapped[int] = mapped_column(Integer)
    funding_pathway_clarity: Mapped[int] = mapped_column(Integer)
    masterplan_alignment: Mapped[int] = mapped_column(Integer)

    recommendation: Mapped[Recommendation] = mapped_column(SAEnum(Recommendation))
    rationale: Mapped[str | None] = mapped_column(Text)
    assessment_date: Mapped[date] = mapped_column(Date)
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Foreign keys
    pitch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pitches.id"))
    assessor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    # Relationships
    pitch = relationship("Pitch", back_populates="assessments")
    assessor = relationship("User", back_populates="assessments")
