"""Attachments — a pitch's files, held in the document library rather than here."""

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PitchAttachment(Base, TimestampMixin):
    """A pointer to one file in the document store, owned by exactly one pitch.

    The bytes never land in this database: the document library stays the system
    of record for content, and this row records only where the file went and
    enough to describe it in a list.
    """

    __tablename__ = "pitch_attachments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # No `ondelete` on the FK. The rows go with the pitch through the ORM cascade
    # on Pitch.attachments, which the SQLite unit suite actually exercises — a
    # database cascade would be invisible there and first observed in production.
    pitch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pitches.id"), index=True)
    # The document store's own address for the item. An addressing detail, never
    # served to a client: see the response schemas.
    store_item_id: Mapped[str] = mapped_column(String(255))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(Integer)
    # Nullable so removing a user doesn't have to take their uploads with them;
    # the attachment outlives the attribution.
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))

    pitch = relationship("Pitch", back_populates="attachments")
    uploaded_by = relationship("User")
