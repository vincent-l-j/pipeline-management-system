"""Assessment CRUD routes — scoring cards linked to pitches."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.assessment import Assessment
from app.models.user import User, UserRole
from app.schemas.assessment import AssessmentCreate, AssessmentOut

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("", response_model=list[AssessmentOut])
def list_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the latest assessment version for each pitch (no historical versions)."""
    # Subquery to get the max version for each pitch
    subquery = (
        db.query(Assessment.pitch_id, func.max(Assessment.version).label("max_version"))
        .group_by(Assessment.pitch_id)
        .subquery()
    )

    # Join to get only rows matching the max version per pitch
    return (
        db.query(Assessment)
        .join(
            subquery,
            (Assessment.pitch_id == subquery.c.pitch_id)
            & (Assessment.version == subquery.c.max_version),
        )
        .order_by(Assessment.assessment_date.desc())
        .all()
    )


@router.get("/{assessment_id}", response_model=AssessmentOut)
def get_assessment(
    assessment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


@router.post("", response_model=AssessmentOut)
def create_assessment(
    data: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
    amending_from_id: UUID | None = Query(None),
):
    # If amending an existing assessment, validate the pitch hasn't changed
    if amending_from_id:
        prior = db.query(Assessment).filter(Assessment.id == amending_from_id).first()
        if not prior:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if prior.pitch_id != data.pitch_id:
            raise HTTPException(
                status_code=422, detail="Cannot change pitch when amending an assessment"
            )

    # Auto-increment version for this pitch
    latest = (
        db.query(Assessment)
        .filter(Assessment.pitch_id == data.pitch_id)
        .order_by(Assessment.version.desc())
        .first()
    )
    next_version = (latest.version + 1) if latest else 1

    assessment = Assessment(
        **data.model_dump(),
        assessor_id=current_user.id,
        version=next_version,
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment
