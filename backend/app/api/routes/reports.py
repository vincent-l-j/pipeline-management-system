"""Reports and metrics endpoints — pipeline summary, velocity, and CSV export."""

import csv
import io
from datetime import datetime, date
from collections import defaultdict

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.pitch import Pitch, PitchStageHistory, PipelineStage
from app.models.organisation import Organisation
from app.models.contact import Contact
from app.models.meeting import Meeting
from app.models.assessment import Assessment

router = APIRouter(prefix="/reports", tags=["reports"])


# --- Pipeline summary and metrics ---

@router.get("/pipeline-summary")
def pipeline_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full pipeline summary — every pitch with its current stage, lead, org, dates."""
    pitches = db.query(Pitch).order_by(Pitch.created_at.desc()).all()
    users = {str(u.id): u.display_name for u in db.query(User).all()}
    orgs = {str(o.id): o.name for o in db.query(Organisation).all()}

    rows = []
    for p in pitches:
        rows.append({
            "id": str(p.id),
            "title": p.title,
            "current_stage": p.current_stage.value if p.current_stage else "",
            "stage_label": p.current_stage.value.replace("_", " ").title() if p.current_stage else "",
            "source": p.source.value if p.source else "",
            "funding_pathway": p.funding_pathway.value if p.funding_pathway else "",
            "domain_tags": p.domain_tags or "",
            "lead": users.get(str(p.lead_id), "") if p.lead_id else "",
            "organisation": orgs.get(str(p.organisation_id), "") if p.organisation_id else "",
            "submission_date": str(p.submission_date) if p.submission_date else "",
            "created_at": p.created_at.isoformat() if p.created_at else "",
            "is_confidential": p.is_confidential,
        })

    return {"pitches": rows, "total": len(rows)}


@router.get("/velocity")
def velocity_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pipeline velocity metrics — pitches received per month, counts by stage,
    conversion rates, and recent activity stats."""

    # --- Pitches by stage ---
    stage_counts = {}
    for stage in PipelineStage:
        count = db.query(Pitch).filter(Pitch.current_stage == stage).count()
        stage_counts[stage.value] = count

    # --- Pitches received per month (last 12 months) ---
    pitches = db.query(Pitch).all()
    monthly = defaultdict(int)
    for p in pitches:
        d = p.submission_date or (p.created_at.date() if p.created_at else None)
        if d:
            key = f"{d.year}-{d.month:02d}"
            monthly[key] += 1

    # Sort by month and take last 12
    sorted_months = sorted(monthly.items())[-12:]
    pitches_per_month = [{"month": m, "count": c} for m, c in sorted_months]

    # --- Conversion: how many pitches have moved beyond initial stages ---
    total = db.query(Pitch).count()
    active_stages = [
        PipelineStage.DEEP_ASSESSMENT,
        PipelineStage.DUE_DILIGENCE,
        PipelineStage.DECISION_PENDING,
        PipelineStage.ACTIVE_SUPPORT,
        PipelineStage.COMPLETED,
    ]
    advanced = db.query(Pitch).filter(Pitch.current_stage.in_(active_stages)).count()
    declined = db.query(Pitch).filter(Pitch.current_stage == PipelineStage.DECLINED).count()
    parked = db.query(Pitch).filter(Pitch.current_stage == PipelineStage.PARKED).count()
    completed = db.query(Pitch).filter(Pitch.current_stage == PipelineStage.COMPLETED).count()

    conversion = {
        "total_pitches": total,
        "advanced_to_assessment": advanced,
        "declined": declined,
        "parked": parked,
        "completed": completed,
        "advancement_rate": round((advanced / total * 100), 1) if total > 0 else 0,
        "decline_rate": round((declined / total * 100), 1) if total > 0 else 0,
    }

    # --- Recent activity counts (last 30 days) ---
    thirty_days_ago = datetime.utcnow().replace(hour=0, minute=0, second=0)
    from datetime import timedelta
    thirty_days_ago = thirty_days_ago - timedelta(days=30)

    recent_pitches = db.query(Pitch).filter(Pitch.created_at >= thirty_days_ago).count()
    recent_meetings = db.query(Meeting).filter(Meeting.created_at >= thirty_days_ago).count()
    recent_assessments = db.query(Assessment).filter(Assessment.created_at >= thirty_days_ago).count()
    recent_stage_changes = db.query(PitchStageHistory).filter(
        PitchStageHistory.changed_at >= thirty_days_ago
    ).count()

    recent = {
        "pitches_added": recent_pitches,
        "meetings_logged": recent_meetings,
        "assessments_created": recent_assessments,
        "stage_changes": recent_stage_changes,
    }

    return {
        "stage_counts": stage_counts,
        "pitches_per_month": pitches_per_month,
        "conversion": conversion,
        "recent_30_days": recent,
    }


# --- CSV exports ---

def _make_csv_response(rows: list[dict], filename: str) -> StreamingResponse:
    """Helper to turn a list of dicts into a CSV download."""
    if not rows:
        output = io.StringIO()
        output.write("No data")
        output.seek(0)
    else:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/pitches")
def export_pitches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = {str(u.id): u.display_name for u in db.query(User).all()}
    orgs = {str(o.id): o.name for o in db.query(Organisation).all()}
    pitches = db.query(Pitch).order_by(Pitch.created_at.desc()).all()

    rows = [{
        "Title": p.title,
        "Stage": p.current_stage.value.replace("_", " ").title() if p.current_stage else "",
        "Source": p.source.value.replace("_", " ").title() if p.source else "",
        "Funding Pathway": p.funding_pathway.value.replace("_", " ").title() if p.funding_pathway else "",
        "Domain Tags": p.domain_tags or "",
        "Lead": users.get(str(p.lead_id), "") if p.lead_id else "",
        "Organisation": orgs.get(str(p.organisation_id), "") if p.organisation_id else "",
        "Submission Date": str(p.submission_date) if p.submission_date else "",
        "Confidential": "Yes" if p.is_confidential else "No",
        "Masterplan Alignment": p.masterplan_alignment or "",
    } for p in pitches]

    return _make_csv_response(rows, f"rozetta_pitches_{date.today()}.csv")


@router.get("/export/organisations")
def export_organisations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orgs = db.query(Organisation).order_by(Organisation.name).all()
    rows = [{
        "Name": o.name,
        "Type": o.org_type.value.replace("_", " ").title() if o.org_type else "",
        "Sector": o.sector or "",
        "State/Territory": o.state_territory or "",
        "Website": o.website or "",
        "ABN": o.abn or "",
        "Notes": o.notes or "",
    } for o in orgs]

    return _make_csv_response(rows, f"rozetta_organisations_{date.today()}.csv")


@router.get("/export/contacts")
def export_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = {str(u.id): u.display_name for u in db.query(User).all()}
    orgs = {str(o.id): o.name for o in db.query(Organisation).all()}
    contacts = db.query(Contact).order_by(Contact.name).all()

    rows = [{
        "Name": c.name,
        "Role": c.role or "",
        "Email": c.email or "",
        "Phone": c.phone or "",
        "LinkedIn": c.linkedin or "",
        "Organisation": orgs.get(str(c.organisation_id), "") if c.organisation_id else "",
        "Relationship Owner": users.get(str(c.relationship_owner_id), "") if c.relationship_owner_id else "",
        "Last Contacted": str(c.last_contacted) if c.last_contacted else "",
        "Notes": c.notes or "",
    } for c in contacts]

    return _make_csv_response(rows, f"rozetta_contacts_{date.today()}.csv")


@router.get("/export/meetings")
def export_meetings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pitches = {str(p.id): p.title for p in db.query(Pitch).all()}
    meetings = db.query(Meeting).order_by(Meeting.meeting_date.desc()).all()

    rows = [{
        "Title": m.title,
        "Pitch": pitches.get(str(m.pitch_id), ""),
        "Date": str(m.meeting_date),
        "Time": str(m.meeting_time) if m.meeting_time else "",
        "Platform": m.platform.value.replace("_", " ").title() if m.platform else "",
        "Summary": m.summary or "",
        "Key Points": m.key_points or "",
        "Action Items": m.action_items or "",
        "Follow-up Date": str(m.follow_up_date) if m.follow_up_date else "",
    } for m in meetings]

    return _make_csv_response(rows, f"rozetta_meetings_{date.today()}.csv")


@router.get("/export/assessments")
def export_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pitches = {str(p.id): p.title for p in db.query(Pitch).all()}
    users = {str(u.id): u.display_name for u in db.query(User).all()}
    assessments = db.query(Assessment).order_by(Assessment.assessment_date.desc()).all()

    rows = [{
        "Pitch": pitches.get(str(a.pitch_id), ""),
        "Version": a.version,
        "Assessor": users.get(str(a.assessor_id), ""),
        "Date": str(a.assessment_date),
        "National Impact": a.national_impact,
        "Translation Readiness": a.translation_readiness,
        "Team Capability": a.team_capability,
        "Ecosystem Fit": a.ecosystem_fit,
        "Funding Pathway Clarity": a.funding_pathway_clarity,
        "Masterplan Alignment": a.masterplan_alignment,
        "Average Score": round(
            (a.national_impact + a.translation_readiness + a.team_capability +
             a.ecosystem_fit + a.funding_pathway_clarity + a.masterplan_alignment) / 6, 1
        ),
        "Recommendation": a.recommendation.value.title() if a.recommendation else "",
        "Rationale": a.rationale or "",
    } for a in assessments]

    return _make_csv_response(rows, f"rozetta_assessments_{date.today()}.csv")
