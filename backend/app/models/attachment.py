"""Attachments — a pitch's files, held in the document store rather than here."""

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PitchAttachment(Base, TimestampMixin):
    """A pointer to one file in the document store, owned by exactly one pitch."""

    __tablename__ = "pitch_attachments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # No `ondelete`: the rows go with the pitch through the ORM cascade on
    # Pitch.attachments, which a test of the API can observe.
    pitch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pitches.id"), index=True)
    # Never served to a client — see AttachmentOut.
    store_item_id: Mapped[str] = mapped_column(String(255))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(Integer)
    # Nullable so removing a user doesn't take their uploads with them.
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))

    pitch = relationship("Pitch", back_populates="attachments")
    uploaded_by = relationship("User")

    @property
    def uploaded_by_name(self) -> str | None:
        """None rather than raising, so a row whose uploader was removed still lists."""
        return self.uploaded_by.display_name if self.uploaded_by else None
