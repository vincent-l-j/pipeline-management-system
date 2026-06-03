"""Pitches — the central entity of the pipeline."""

from sqlalchemy import (
    String, Text, Date, Boolean, ForeignKey, Enum as SAEnum, ARRAY
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from datetime import date, datetime
import enum
import uuid

from app.models.base import Base, TimestampMixin


class PipelineStage(str, enum.Enum):
    RECEIVED = "received"
    INITIAL_SCREEN = "initial_screen"
    DISCOVERY_MEETING = "discovery_meeting"
    DEEP_ASSESSMENT = "deep_assessment"
    DUE_DILIGENCE = "due_diligence"
    DECISION_PENDING = "decision_pending"
    ACTIVE_SUPPORT = "active_support"
    PARKED = "parked"
    DECLINED = "declined"
    COMPLETED = "completed"


class PitchSource(str, enum.Enum):
    REFERRAL = "referral"
    WEBSITE = "website"
    EVENT = "event"
    COLD_OUTREACH = "cold_outreach"
    INTERNAL = "internal"


class FundingPathway(str, enum.Enum):
    CRC_BID = "crc_bid"
    RDTI = "rdti"
    PHILANTHROPIC = "philanthropic"
    GOVERNMENT_GRANT = "government_grant"
    PRIVATE = "private"
    OTHER = "other"


class Pitch(Base, TimestampMixin):
    __tablename__ = "pitches"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), index=True)
    short_description: Mapped[str | None] = mapped_column(Text)
    submission_date: Mapped[date | None] = mapped_column(Date)
    source: Mapped[PitchSource | None] = mapped_column(SAEnum(PitchSource))
    current_stage: Mapped[PipelineStage] = mapped_column(
        SAEnum(PipelineStage), default=PipelineStage.RECEIVED
    )
    domain_tags: Mapped[str | None] = mapped_column(Text)  # comma-separated: climate,health,digital
    funding_pathway: Mapped[FundingPathway | None] = mapped_column(SAEnum(FundingPathway))
    masterplan_alignment: Mapped[str | None] = mapped_column(Text)
    is_confidential: Mapped[bool] = mapped_column(Boolean, default=False)

    # Foreign keys
    organisation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organisations.id")
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))

    # Relationships
    organisation = relationship("Organisation", back_populates="pitches")
    lead = relationship("User", back_populates="led_pitches", foreign_keys=[lead_id])
    stage_history = relationship(
        "PitchStageHistory", back_populates="pitch", order_by="PitchStageHistory.changed_at"
    )
    contact_links = relationship("PitchContact", back_populates="pitch")
    file_links = relationship("PitchFileLink", back_populates="pitch")
    meetings = relationship("Meeting", back_populates="pitch")
    assessments = relationship("Assessment", back_populates="pitch")


class PitchStageHistory(Base):
    """Records every stage transition for a pitch."""
    __tablename__ = "pitch_stage_history"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    pitch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pitches.id"))
    from_stage: Mapped[PipelineStage | None] = mapped_column(SAEnum(PipelineStage))
    to_stage: Mapped[PipelineStage] = mapped_column(SAEnum(PipelineStage))
    changed_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow
    )
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text)

    # Relationships
    pitch = relationship("Pitch", back_populates="stage_history")
    changed_by = relationship("User")


class PitchContact(Base):
    """Links contacts to pitches (many-to-many)."""
    __tablename__ = "pitch_contacts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    pitch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pitches.id"))
    contact_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contacts.id"))
    role_in_pitch: Mapped[str | None] = mapped_column(String(255))

    pitch = relationship("Pitch", back_populates="contact_links")
    contact = relationship("Contact", back_populates="pitch_links")


class PitchFileLink(Base, TimestampMixin):
    """Local file path references attached to a pitch (no file storage in DB)."""
    __tablename__ = "pitch_file_links"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    pitch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pitches.id"))
    file_path: Mapped[str] = mapped_column(String(1000))
    label: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)

    pitch = relationship("Pitch", back_populates="file_links")
