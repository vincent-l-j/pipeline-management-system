"""Activity timeline for a pitch — aggregates all events chronologically."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.pitch import Pitch, PitchStageHistory
from app.models.meeting import Meeting
from app.models.assessment import Assessment

router = APIRouter(prefix="/pitches", tags=["timeline"])


@router.get("/{pitch_id}/timeline")
def get_pitch_timeline(
    pitch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a chronological timeline of all events for a pitch.

    Event types:
    - stage_change: pitch moved to a new pipeline stage
    - meeting: meeting logged for this pitch
    - assessment: assessment created for this pitch
    - created: pitch was first created
    """
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")

    # Resolve user names
    users = {str(u.id): u.display_name for u in db.query(User).all()}
    events = []

    # Pitch creation
    events.append({
        "type": "created",
        "date": pitch.created_at.isoformat(),
        "title": "Pitch created",
        "description": f'"{pitch.title}" was added to the pipeline',
        "actor": users.get(str(pitch.lead_id), "Unknown"),
    })

    # Stage changes
    history = (
        db.query(PitchStageHistory)
        .filter(PitchStageHistory.pitch_id == pitch_id)
        .order_by(PitchStageHistory.changed_at)
        .all()
    )
    for h in history:
        from_label = h.from_stage.replace("_", " ").title() if h.from_stage else "New"
        to_label = h.to_stage.replace("_", " ").title() if h.to_stage else "Unknown"
        events.append({
            "type": "stage_change",
            "date": h.changed_at.isoformat(),
            "title": f"Stage: {to_label}",
            "description": f"Moved from {from_label} to {to_label}" + (f" — {h.note}" if h.note else ""),
            "actor": users.get(str(h.changed_by_id), "Unknown") if h.changed_by_id else "System",
        })

    # Meetings
    meetings = (
        db.query(Meeting)
        .filter(Meeting.pitch_id == pitch_id)
        .all()
    )
    for m in meetings:
        events.append({
            "type": "meeting",
            "date": m.created_at.isoformat(),
            "title": f"Meeting: {m.title}",
            "description": m.summary[:200] + "..." if m.summary and len(m.summary) > 200 else m.summary or "No summary",
            "meeting_id": str(m.id),
            "meeting_date": str(m.meeting_date),
            "actor": None,
        })

    # Assessments
    assessments = (
        db.query(Assessment)
        .filter(Assessment.pitch_id == pitch_id)
        .all()
    )
    for a in assessments:
        rec_label = a.recommendation.replace("_", " ").title() if a.recommendation else "Unknown"
        events.append({
            "type": "assessment",
            "date": a.created_at.isoformat(),
            "title": f"Assessment v{a.version}: {rec_label}",
            "description": a.rationale[:200] + "..." if a.rationale and len(a.rationale) > 200 else a.rationale or "No rationale",
            "assessment_id": str(a.id),
            "actor": users.get(str(a.assessor_id), "Unknown"),
        })

    # Sort all events by date descending (newest first)
    events.sort(key=lambda e: e["date"], reverse=True)

    return {"pitch_id": str(pitch_id), "events": events, "total": len(events)}
