"""A pitch's attachments — the files it has in the document library.

A router of its own rather than more of `pitches.py`, for the reason `timeline.py`
is: the attachment surface has its own dependency (the document store) and its own
reasons to change. The prefix keeps the URL a sub-resource of the pitch, which is
also the authorization story — an attachment is reachable only through its pitch.
"""

import logging
import os
from pathlib import PurePosixPath
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.documents import get_document_store
from app.core.security import get_current_user, require_role
from app.models.attachment import PitchAttachment
from app.models.pitch import Pitch
from app.models.user import User, UserRole
from app.schemas.attachment import AttachmentOut
from app.services.document_store import DocumentStore, DocumentStoreError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pitches", tags=["attachments"])

# A cap on what one upload can be, as a module constant — the same shape as the
# field caps in `client_errors.py`. 25 MB comfortably holds a deck or a business
# case, and the instance this runs on has 512 MB of memory in total.
MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

# The types a pitch actually arrives as, and the content type each is recorded
# and served with. Keyed by extension rather than by the caller's declared type:
# the declaration is a claim about a file we already hold, while the extension is
# what the document library and the browser will both act on. Deriving the
# content type here is also what stops a caller choosing it.
ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


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


def _attachment_of_pitch(pitch_id: UUID, attachment_id: UUID, db: Session) -> PitchAttachment:
    """The attachment, resolved *against the pitch in the path*, or a 404.

    Both ids are filtered on, never just the attachment's. An identifier is not an
    authorisation: naming a real attachment under a pitch it does not belong to
    has to resolve to nothing, even for a caller who may edit the pitch they
    named. Filtering on the attachment alone would make the pitch in the URL
    decorative, and the check it carries would quietly stop being a check.
    """
    attachment = (
        db.query(PitchAttachment)
        .filter(
            PitchAttachment.id == attachment_id,
            PitchAttachment.pitch_id == pitch_id,
        )
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return attachment


def _accepted_name(upload: UploadFile) -> tuple[str, str]:
    """The file's own name and the content type it will be recorded with.

    Refuses with a message naming the limit it broke, because "no" on its own
    leaves the user guessing at which rule they hit.
    """
    # Any path the browser sent is dropped here as well as in the adapter: this is
    # the name the record shows, and a row reading `C:\decks\x.pdf` is just wrong.
    filename = PurePosixPath((upload.filename or "").replace("\\", "/")).name
    if not filename:
        raise HTTPException(status_code=400, detail="No file was provided")

    suffix = os.path.splitext(filename)[1].lower()
    content_type = ALLOWED_TYPES.get(suffix)
    if content_type is None:
        allowed = ", ".join(sorted(ALLOWED_TYPES))
        raise HTTPException(
            status_code=400,
            detail=f"Files of this type are not accepted. Allowed types: {allowed}",
        )
    return filename, content_type


def _accepted_size(upload: UploadFile) -> int:
    """The file's true size, measured rather than believed.

    Seeked rather than read from the declared length: `Content-Length` is the
    caller's claim, and this is the number the limit has to be applied to.
    """
    upload.file.seek(0, os.SEEK_END)
    size_bytes = upload.file.tell()
    upload.file.seek(0)
    if size_bytes > MAX_ATTACHMENT_BYTES:
        limit_mb = MAX_ATTACHMENT_BYTES // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File is larger than the {limit_mb} MB limit")
    return size_bytes


@router.post("/{pitch_id}/attachments", response_model=AttachmentOut, status_code=201)
def upload_attachment(
    pitch_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    store: DocumentStore = Depends(get_document_store),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    """Validate a file, send it to the document store, then record where it went.

    In that order, and the order is the feature. Validation runs first so a
    rejected file never leaves the process. The record is written only once the
    store has confirmed, because a row pointing at a file that was never stored
    reads as success until someone clicks it — which is worse than the failure it
    would be hiding.
    """
    pitch = _readable_pitch(pitch_id, db)
    filename, content_type = _accepted_name(file)
    size_bytes = _accepted_size(file)

    try:
        stored = store.upload(
            # The pitch's id, never its title: a retitled pitch must not orphan
            # the files already filed under the old name.
            folder=str(pitch.id),
            filename=filename,
            content=file.file,
            size_bytes=size_bytes,
            content_type=content_type,
        )
    except DocumentStoreError as exc:
        # The store's own message goes to the log, correlated by request id; the
        # caller gets fixed text. Everything this failure knows is derived from a
        # credential or from a signed URL, and none of that belongs in a response.
        logger.error(
            "Attachment upload failed at the document store",
            extra={"pitch_id": str(pitch.id), "store_error": str(exc)},
        )
        raise HTTPException(
            status_code=502,
            detail="The file could not be saved to the document library. Please try again.",
        ) from exc

    attachment = PitchAttachment(
        pitch_id=pitch.id,
        store_item_id=stored.item_id,
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        uploaded_by_id=current_user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


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


@router.delete("/{pitch_id}/attachments/{attachment_id}")
def delete_attachment(
    pitch_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
    store: DocumentStore = Depends(get_document_store),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    """Remove an attachment from the pitch and from the document store.

    The store goes first and the row only if it agreed. Should the store refuse,
    the record stays: a row whose file is gone can be found and cleaned up, while
    a file with no row is invisible to everyone.
    """
    _readable_pitch(pitch_id, db)
    attachment = _attachment_of_pitch(pitch_id, attachment_id, db)

    try:
        store.delete(attachment.store_item_id)
    except DocumentStoreError as exc:
        logger.error(
            "Attachment deletion failed at the document store",
            extra={
                "pitch_id": str(pitch_id),
                "attachment_id": str(attachment_id),
                "store_error": str(exc),
            },
        )
        raise HTTPException(
            status_code=502,
            detail="The file could not be removed from the document library. Please try again.",
        ) from exc

    db.delete(attachment)
    db.commit()
    return {"detail": "Attachment deleted"}
