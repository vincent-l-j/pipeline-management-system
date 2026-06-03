"""Full-text search across all record types."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.pitch import Pitch
from app.models.organisation import Organisation
from app.models.contact import Contact
from app.models.meeting import Meeting
from app.models.assessment import Assessment

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
def search_all(
    q: str = Query(..., min_length=2, description="Search query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search across pitches, organisations, contacts, meetings, and assessments.

    Returns categorised results with enough info to display in search results
    and link through to the detail page.
    """
    term = f"%{q}%"
    results = {}

    # Pitches — search title, description, domain tags, masterplan alignment
    pitches = db.query(Pitch).filter(
        or_(
            Pitch.title.ilike(term),
            Pitch.short_description.ilike(term),
            Pitch.domain_tags.ilike(term),
            Pitch.masterplan_alignment.ilike(term),
        )
    ).limit(20).all()
    results["pitches"] = [
        {
            "id": str(p.id),
            "title": p.title,
            "subtitle": p.short_description or "",
            "badge": p.current_stage.replace("_", " ").title() if p.current_stage else "",
            "type": "pitch",
        }
        for p in pitches
    ]

    # Organisations — search name, sector, notes
    orgs = db.query(Organisation).filter(
        or_(
            Organisation.name.ilike(term),
            Organisation.sector.ilike(term),
            Organisation.notes.ilike(term),
        )
    ).limit(20).all()
    results["organisations"] = [
        {
            "id": str(o.id),
            "title": o.name,
            "subtitle": o.sector or "",
            "badge": o.org_type.replace("_", " ").title() if o.org_type else "",
            "type": "organisation",
        }
        for o in orgs
    ]

    # Contacts — search name, role, email, notes
    contacts = db.query(Contact).filter(
        or_(
            Contact.name.ilike(term),
            Contact.role.ilike(term),
            Contact.email.ilike(term),
            Contact.notes.ilike(term),
        )
    ).limit(20).all()
    results["contacts"] = [
        {
            "id": str(c.id),
            "title": c.name,
            "subtitle": c.role or c.email or "",
            "badge": "",
            "type": "contact",
        }
        for c in contacts
    ]

    # Meetings — search title, summary, key points, action items
    meetings = db.query(Meeting).filter(
        or_(
            Meeting.title.ilike(term),
            Meeting.summary.ilike(term),
            Meeting.key_points.ilike(term),
            Meeting.action_items.ilike(term),
        )
    ).limit(20).all()
    results["meetings"] = [
        {
            "id": str(m.id),
            "title": m.title,
            "subtitle": str(m.meeting_date),
            "badge": m.platform.replace("_", " ").title() if m.platform else "",
            "type": "meeting",
        }
        for m in meetings
    ]

    # Assessments — search rationale
    assessments = db.query(Assessment).filter(
        Assessment.rationale.ilike(term),
    ).limit(20).all()
    results["assessments"] = [
        {
            "id": str(a.id),
            "title": f"Assessment v{a.version}",
            "subtitle": f"{a.assessment_date} — {a.recommendation.replace('_', ' ').title()}",
            "badge": a.recommendation.title(),
            "type": "assessment",
        }
        for a in assessments
    ]

    # Total count
    results["total"] = sum(len(v) for v in results.values() if isinstance(v, list))

    return results
