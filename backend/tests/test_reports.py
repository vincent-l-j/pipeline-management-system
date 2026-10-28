"""Tests for /api/reports — pipeline summary, velocity metrics, and CSV exports."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.models.pitch import PitchStageHistory


def _create_pitch(client, title="Report Test Pitch"):
    return client.post("/api/pitches", json={"title": title}).json()


# --- Pipeline summary ---


def test_pipeline_summary_shape(admin_client):
    _create_pitch(admin_client, "Summary Pitch A")
    resp = admin_client.get("/api/reports/pipeline-summary")
    assert resp.status_code == 200
    body = resp.json()
    assert "pitches" in body
    assert "total" in body
    assert isinstance(body["pitches"], list)
    assert body["total"] == len(body["pitches"])


def test_pipeline_summary_row_fields(admin_client):
    _create_pitch(admin_client, "Summary Pitch Fields")
    resp = admin_client.get("/api/reports/pipeline-summary")
    pitches = resp.json()["pitches"]
    assert len(pitches) > 0
    row = pitches[0]
    for field in ("id", "title", "current_stage", "stage_label", "is_confidential"):
        assert field in row, f"Missing field: {field}"


# --- Velocity metrics ---


def test_velocity_shape(admin_client):
    resp = admin_client.get("/api/reports/velocity")
    assert resp.status_code == 200
    body = resp.json()
    assert "stage_counts" in body
    assert "pitches_per_month" in body
    assert "conversion" in body
    assert "recent_30_days" in body


def test_velocity_stage_counts_all_stages(admin_client):
    resp = admin_client.get("/api/reports/velocity")
    stage_counts = resp.json()["stage_counts"]
    expected_stages = [
        "initial_screen",
        "discovery_meeting",
        "due_diligence",
        "decision_pending",
        "active_support",
        "parked",
        "declined",
        "completed",
    ]
    for stage in expected_stages:
        assert stage in stage_counts, f"Stage missing from counts: {stage}"


def test_velocity_conversion_fields(admin_client):
    resp = admin_client.get("/api/reports/velocity")
    conversion = resp.json()["conversion"]
    for field in ("total_pitches", "advanced_to_assessment", "declined", "parked", "completed"):
        assert field in conversion


def test_a_pitch_in_due_diligence_counts_as_advanced(admin_client):
    pid = _create_pitch(admin_client, "In diligence")["id"]
    moved = admin_client.post(f"/api/pitches/{pid}/stage", json={"new_stage": "due_diligence"})
    assert moved.status_code == 200

    conversion = admin_client.get("/api/reports/velocity").json()["conversion"]

    assert conversion["advanced_to_assessment"] == 1


def test_velocity_recent_activity_fields(admin_client):
    resp = admin_client.get("/api/reports/velocity")
    recent = resp.json()["recent_30_days"]
    for field in ("pitches_added", "meetings_logged", "assessments_created", "stage_changes"):
        assert field in recent


# --- CSV exports ---


def test_export_pitches_csv(admin_client):
    # An empty export is the string "No data" and carries no header row, so the
    # arrangement is what makes this a test of the header rather than of that.
    admin_client.post("/api/pitches", json={"title": "Csv Exported Pitch"})

    resp = admin_client.get("/api/reports/export/pitches")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    content = resp.text
    # CSV header must contain pitch fields
    assert "Title" in content
    assert "Stage" in content


def test_export_organisations_csv(admin_client):
    admin_client.post("/api/organisations", json={"name": "Csv Exported Org"})

    resp = admin_client.get("/api/reports/export/organisations")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Name" in resp.text


def test_export_contacts_csv(admin_client):
    admin_client.post("/api/contacts", json={"first_name": "Csv", "last_name": "Exported"})

    resp = admin_client.get("/api/reports/export/contacts")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "First Name" in resp.text
    assert "Last Name" in resp.text
    assert "Csv,Exported" in resp.text


def test_export_contacts_csv_lists_every_organisation(admin_client):
    """One cell holds all affiliations, semicolon-separated so the comma-delimited
    CSV does not split them across columns."""
    org_ids = [
        admin_client.post("/api/organisations", json={"name": name}).json()["id"]
        for name in ("Export Org A", "Export Org B")
    ]
    admin_client.post(
        "/api/contacts",
        json={"first_name": "Multi", "last_name": "Affiliated", "organisation_ids": org_ids},
    )

    resp = admin_client.get("/api/reports/export/contacts")
    assert resp.status_code == 200
    assert "Export Org A; Export Org B" in resp.text


def test_export_meetings_csv(admin_client):
    resp = admin_client.get("/api/reports/export/meetings")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]


def test_export_assessments_csv(admin_client):
    resp = admin_client.get("/api/reports/export/assessments")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]


# --- Auth ---


def test_unauthenticated_cannot_access_reports(client):
    resp = client.get("/api/reports/pipeline-summary")
    assert resp.status_code == 403


def _declined_long_ago(client, db_session, title: str) -> str:
    """A pitch declined well past the Pipeline page's hiding threshold."""
    pid = client.post("/api/pitches", json={"title": title}).json()["id"]
    client.post(f"/api/pitches/{pid}/stage", json={"new_stage": "declined"})
    db_session.query(PitchStageHistory).filter(PitchStageHistory.pitch_id == UUID(pid)).update(
        {PitchStageHistory.changed_at: datetime.now(UTC) - timedelta(days=400)}
    )
    db_session.commit()
    return pid


def test_reports_still_include_a_pitch_declined_long_ago(admin_client, db_session):
    _declined_long_ago(admin_client, db_session, "Declined Long Ago")

    summary = admin_client.get("/api/reports/pipeline-summary").json()
    export = admin_client.get("/api/reports/export/pitches").text

    assert "Declined Long Ago" in [p["title"] for p in summary["pitches"]]
    assert "Declined Long Ago" in export
