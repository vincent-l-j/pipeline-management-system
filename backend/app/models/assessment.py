"""Assessments — scoring cards linked to pitches."""

import enum
import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Recommendation(enum.StrEnum):
    PROCEED = "proceed"
    PARK = "park"
    DECLINE = "decline"


class DeclineReason(enum.StrEnum):
    """Why a pitch was turned away.

    An enum rather than free text because the point of capturing it is to be able
    to count it: "what are we declining, and for what reason". Extending it means
    a migration, which is the price of that.
    """

    NOT_STRATEGIC_PRIORITY = "not_strategic_priority"
    INSUFFICIENT_SCALE = "insufficient_scale"
    INSUFFICIENT_CAPACITY_CAPABILITY = "insufficient_capacity_capability"
    GRANT_FUNDING_REJECTED = "grant_funding_rejected"
    LACK_OF_ROZETTA_CAPACITY = "lack_of_rozetta_capacity"
    OTHER = "other"


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
    # Only meaningful when recommendation is DECLINE, and optional even then —
    # AssessmentCreate rejects a reason set against any other recommendation.
    decline_reason: Mapped[DeclineReason | None] = mapped_column(SAEnum(DeclineReason))
    rationale: Mapped[str | None] = mapped_column(Text)
    assessment_date: Mapped[date] = mapped_column(Date)
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Foreign keys
    pitch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pitches.id"))
    assessor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    # Relationships
    pitch = relationship("Pitch", back_populates="assessments")
    assessor = relationship("User", back_populates="assessments")
