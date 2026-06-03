"""Meetings linked to pitches, with internal and external attendees."""

from sqlalchemy import String, Text, Date, Time, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date, time
import enum
import uuid

from app.models.base import Base, TimestampMixin


class MeetingPlatform(str, enum.Enum):
    ZOOM = "zoom"
    TEAMS = "teams"
    IN_PERSON = "in_person"
    PHONE = "phone"
    OTHER = "other"


class Meeting(Base, TimestampMixin):
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500))
    meeting_date: Mapped[date] = mapped_column(Date)
    meeting_time: Mapped[time | None] = mapped_column(Time)
    platform: Mapped[MeetingPlatform | None] = mapped_column(SAEnum(MeetingPlatform))
    summary: Mapped[str | None] = mapped_column(Text)
    key_points: Mapped[str | None] = mapped_column(Text)
    action_items: Mapped[str | None] = mapped_column(Text)
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    recording_link: Mapped[str | None] = mapped_column(String(1000))
    transcript_path: Mapped[str | None] = mapped_column(String(1000))
    ai_import_status: Mapped[str | None] = mapped_column(String(50))

    # Foreign key
    pitch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pitches.id"))

    # Relationships
    pitch = relationship("Pitch", back_populates="meetings")
    attendees = relationship("MeetingAttendee", back_populates="meeting")


class MeetingAttendee(Base):
    """Links people to meetings — can be internal (User) or external (Contact)."""
    __tablename__ = "meeting_attendees"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    meeting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("meetings.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    contact_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contacts.id"))
    is_internal: Mapped[bool] = mapped_column(default=True)

    meeting = relationship("Meeting", back_populates="attendees")
    user = relationship("User")
    contact = relationship("Contact", back_populates="meeting_attendances")
