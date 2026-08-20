"""Pitch CRUD routes with stage transitions and file links."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.assessment import Assessment
from app.models.contact import Contact
from app.models.pitch import PipelineStage, Pitch, PitchContact, PitchFileLink, PitchStageHistory
from app.models.user import User, UserRole
from app.schemas.assessment import AssessmentOut
from app.schemas.pitch import (
    PitchCreate,
    PitchFileLinkCreate,
    PitchFileLinkOut,
    PitchOut,
    PitchStageUpdate,
    PitchUpdate,
    StageHistoryOut,
)

router = APIRouter(prefix="/pitches", tags=["pitches"])


def _set_contacts(pitch: Pitch, contact_ids: list[UUID], db: Session) -> None:
    """Replace the contacts linked to a pitch with the given ones.

    Duplicates collapse — the same person twice is one link. The set is
    unordered; callers that display it should sort by whatever they show.

    Assigning through the relationship (rather than deleting rows by query) lets
    delete-orphan clear the old links and keeps the in-memory pitch consistent,
    so the response reports what was just asked for.
    """
    wanted = list(dict.fromkeys(contact_ids))
    if wanted:
        known = {
            contact_id
            for (contact_id,) in db.query(Contact.id).filter(Contact.id.in_(wanted)).all()
        }
        missing = [contact_id for contact_id in wanted if contact_id not in known]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown contact: {', '.join(str(contact_id) for contact_id in missing)}",
            )

    pitch.contact_links = [PitchContact(contact_id=contact_id) for contact_id in wanted]


@router.get("", response_model=list[PitchOut])
def list_pitches(
    stage: PipelineStage | None = Query(None),
    lead_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Eager-loaded: PitchOut reads contact_ids off every row, which would
    # otherwise be one query per pitch.
    query = db.query(Pitch).options(selectinload(Pitch.contact_links))
    if stage:
        query = query.filter(Pitch.current_stage == stage)
    if lead_id:
        query = query.filter(Pitch.lead_id == lead_id)
    return query.order_by(Pitch.created_at.desc()).all()


@router.get("/{pitch_id}", response_model=PitchOut)
def get_pitch(
    pitch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch


@router.post("", response_model=PitchOut)
def create_pitch(
    data: PitchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    fields = data.model_dump()
    contact_ids = fields.pop("contact_ids")
    pitch = Pitch(**fields)
    # Before the add, so an unknown contact aborts with nothing written.
    _set_contacts(pitch, contact_ids, db)
    db.add(pitch)
    db.flush()

    # Record initial stage in history
    history = PitchStageHistory(
        pitch_id=pitch.id,
        from_stage=None,
        to_stage=pitch.current_stage,
        changed_by_id=current_user.id,
        note="Pitch created",
    )
    db.add(history)
    db.commit()
    db.refresh(pitch)
    return pitch


@router.patch("/{pitch_id}", response_model=PitchOut)
def update_pitch(
    pitch_id: UUID,
    data: PitchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    fields = data.model_dump(exclude_unset=True)
    contact_ids = fields.pop("contact_ids", None)
    for field, value in fields.items():
        setattr(pitch, field, value)
    if contact_ids is not None:
        try:
            _set_contacts(pitch, contact_ids, db)
        except HTTPException:
            # A rejected link must not commit the other fields set above.
            db.rollback()
            raise
    db.commit()
    db.refresh(pitch)
    return pitch


@router.post("/{pitch_id}/stage", response_model=PitchOut)
def update_pitch_stage(
    pitch_id: UUID,
    data: PitchStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    """Move a pitch to a new pipeline stage. Records the transition in history."""
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")

    old_stage = pitch.current_stage
    pitch.current_stage = data.new_stage

    history = PitchStageHistory(
        pitch_id=pitch.id,
        from_stage=old_stage,
        to_stage=data.new_stage,
        changed_by_id=current_user.id,
        note=data.note,
    )
    db.add(history)
    db.commit()
    db.refresh(pitch)
    return pitch


@router.get("/{pitch_id}/history", response_model=list[StageHistoryOut])
def get_pitch_history(
    pitch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(PitchStageHistory)
        .filter(PitchStageHistory.pitch_id == pitch_id)
        .order_by(PitchStageHistory.changed_at)
        .all()
    )


@router.get("/{pitch_id}/assessments", response_model=list[AssessmentOut])
def get_pitch_assessments(
    pitch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all assessment versions for a pitch, ordered by version (newest first)."""
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return (
        db.query(Assessment)
        .filter(Assessment.pitch_id == pitch_id)
        .order_by(Assessment.version.desc())
        .all()
    )


@router.delete("/{pitch_id}")
def delete_pitch(
    pitch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    db.delete(pitch)
    db.commit()
    return {"detail": "Pitch deleted"}


# --- File links ---


@router.post("/{pitch_id}/files", response_model=PitchFileLinkOut)
def add_file_link(
    pitch_id: UUID,
    data: PitchFileLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    link = PitchFileLink(pitch_id=pitch_id, **data.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.get("/{pitch_id}/files", response_model=list[PitchFileLinkOut])
def list_file_links(
    pitch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(PitchFileLink).filter(PitchFileLink.pitch_id == pitch_id).all()
