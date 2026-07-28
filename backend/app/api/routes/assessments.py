"""Assessment CRUD routes — scoring cards linked to pitches."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.assessment import Assessment
from app.schemas.assessment import AssessmentCreate, AssessmentOut

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("", response_model=list[AssessmentOut])
def list_assessments(
    pitch_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Assessment)

    if pitch_id:
        # When filtering by pitch_id, return all versions for that pitch (for history view)
        query = query.filter(Assessment.pitch_id == pitch_id)
    else:
        # When listing all assessments, return only the latest version per pitch
        subquery = (
            db.query(
                Assessment.pitch_id,
                func.max(Assessment.version).label("max_version")
            )
            .group_by(Assessment.pitch_id)
            .subquery()
        )
        query = query.join(
            subquery,
            (Assessment.pitch_id == subquery.c.pitch_id) & (Assessment.version == subquery.c.max_version)
        )

    return query.order_by(Assessment.assessment_date.desc()).all()


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
):
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
