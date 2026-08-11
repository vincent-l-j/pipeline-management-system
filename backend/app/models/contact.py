"""External contacts / people linked to pitches and meetings."""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Contact(Base, TimestampMixin):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(255), index=True)
    last_name: Mapped[str | None] = mapped_column(String(255), index=True)
    role: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    linkedin: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    last_contacted: Mapped[date | None] = mapped_column(Date)

    # Foreign keys
    organisation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organisations.id"))
    relationship_owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))

    # Relationships
    organisation = relationship("Organisation", back_populates="contacts")
    relationship_owner = relationship("User")
    pitch_links = relationship("PitchContact", back_populates="contact")
    meeting_attendances = relationship("MeetingAttendee", back_populates="contact")

    @property
    def full_name(self) -> str:
        return " ".join(part for part in (self.first_name, self.last_name) if part)
