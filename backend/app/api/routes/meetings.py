"""Meeting CRUD routes with attendee management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.meeting import Meeting, MeetingAttendee
from app.schemas.meeting import (
    MeetingCreate, MeetingUpdate, MeetingOut, MeetingAttendeeAdd, MeetingAttendeeOut,
    AINoteParseRequest, AINoteParseResponse,
)
from app.services.ai_notetaker import parse_meeting_notes

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("/", response_model=list[MeetingOut])
def list_meetings(
    pitch_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Meeting)
    if pitch_id:
        query = query.filter(Meeting.pitch_id == pitch_id)
    return query.order_by(Meeting.meeting_date.desc()).all()


@router.get("/{meeting_id}", response_model=MeetingOut)
def get_meeting(
    meeting_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.post("/", response_model=MeetingOut)
def create_meeting(
    data: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    meeting = Meeting(**data.model_dump())
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.patch("/{meeting_id}", response_model=MeetingOut)
def update_meeting(
    meeting_id: UUID,
    data: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(meeting, field, value)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}")
def delete_meeting(
    meeting_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(meeting)
    db.commit()
    return {"detail": "Meeting deleted"}


# --- Attendees ---

@router.post("/{meeting_id}/attendees", response_model=MeetingAttendeeOut)
def add_attendee(
    meeting_id: UUID,
    data: MeetingAttendeeAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    attendee = MeetingAttendee(meeting_id=meeting_id, **data.model_dump())
    db.add(attendee)
    db.commit()
    db.refresh(attendee)
    return attendee


@router.get("/{meeting_id}/attendees", response_model=list[MeetingAttendeeOut])
def list_attendees(
    meeting_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(MeetingAttendee).filter(MeetingAttendee.meeting_id == meeting_id).all()


@router.delete("/{meeting_id}/attendees/{attendee_id}")
def remove_attendee(
    meeting_id: UUID,
    attendee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    attendee = (
        db.query(MeetingAttendee)
        .filter(MeetingAttendee.id == attendee_id, MeetingAttendee.meeting_id == meeting_id)
        .first()
    )
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")
    db.delete(attendee)
    db.commit()
    return {"detail": "Attendee removed"}


# --- AI Notetaker ---

@router.post("/parse-notes", response_model=AINoteParseResponse)
def parse_notes(
    data: AINoteParseRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    """Parse raw meeting notes into structured fields using AI (or mock parser).

    The user pastes raw meeting notes. This endpoint parses them into
    summary, key points, action items, follow-up date, and attendees.
    The parsed data is returned for review — nothing is saved yet.
    The user confirms/edits on the frontend before saving to a meeting record.
    """
    if not data.raw_notes.strip():
        raise HTTPException(status_code=400, detail="No notes provided")

    try:
        result = parse_meeting_notes(data.raw_notes)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse notes: {str(e)}")
