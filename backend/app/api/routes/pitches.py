"""Pitch CRUD routes with stage transitions and file links."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.pitch import Pitch, PitchStageHistory, PitchFileLink, PipelineStage
from app.schemas.pitch import (
    PitchCreate, PitchUpdate, PitchOut, PitchStageUpdate,
    StageHistoryOut, PitchFileLinkCreate, PitchFileLinkOut,
)

router = APIRouter(prefix="/pitches", tags=["pitches"])


@router.get("", response_model=list[PitchOut])
def list_pitches(
    stage: Optional[PipelineStage] = Query(None),
    lead_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Pitch)
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
    pitch = Pitch(**data.model_dump())
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
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pitch, field, value)
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
