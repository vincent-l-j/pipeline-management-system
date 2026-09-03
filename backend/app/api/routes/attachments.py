"""A pitch's attachments — the files it has in the document library.

A router of its own rather than more of `pitches.py`, for the reason `timeline.py`
is: the attachment surface has its own dependency (the document store) and its own
reasons to change. The prefix keeps the URL a sub-resource of the pitch, which is
also the authorization story — an attachment is reachable only through its pitch.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.attachment import PitchAttachment
from app.models.pitch import Pitch
from app.models.user import User
from app.schemas.attachment import AttachmentOut

router = APIRouter(prefix="/pitches", tags=["attachments"])


def _readable_pitch(pitch_id: UUID, db: Session) -> Pitch:
    """The pitch, or a 404.

    One place, so read access to an attachment is defined as read access to its
    pitch and stays that way — the day pitches gain a per-caller rule, this is
    where it lands rather than in each of four endpoints.
    """
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch


@router.get("/{pitch_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(
    pitch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every caller who can read the pitch, viewers included.

    Seeing that a document exists is not being able to change it, and a read-only
    user with no visibility of the attachments cannot do their job.
    """
    _readable_pitch(pitch_id, db)
    return (
        db.query(PitchAttachment)
        # Eager-loaded: AttachmentOut reads the uploader's name off every row,
        # which would otherwise be one query per attachment.
        .options(selectinload(PitchAttachment.uploaded_by))
        .filter(PitchAttachment.pitch_id == pitch_id)
        .order_by(PitchAttachment.created_at.desc())
        .all()
    )
