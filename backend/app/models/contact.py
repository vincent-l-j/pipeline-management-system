"""External contacts / people linked to pitches and meetings."""

import uuid

from sqlalchemy import ForeignKey, String, Text, inspect
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

# Housekeeping columns are always set, so they never make a row meaningful.
_METADATA_COLUMNS = frozenset({"id", "created_at", "updated_at"})


def _has_value(value: object) -> bool:
    return value.strip() != "" if isinstance(value, str) else value is not None


class Contact(Base, TimestampMixin):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str | None] = mapped_column(String(255), index=True)
    last_name: Mapped[str | None] = mapped_column(String(255), index=True)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    linkedin: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)

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

    @property
    def is_blank(self) -> bool:
        """True when no detail at all is recorded. A nameless contact is fine —
        an email or an organisation identifies it — but a row with nothing in it
        is not a contact."""
        return not any(
            _has_value(getattr(self, column))
            for column in inspect(type(self)).columns.keys()
            if column not in _METADATA_COLUMNS
        )
