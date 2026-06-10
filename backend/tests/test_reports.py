"""Tests for /api/reports — pipeline summary, velocity metrics, and CSV exports."""


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
        "received", "initial_screen", "discovery_meeting", "deep_assessment",
        "due_diligence", "decision_pending", "active_support", "parked", "declined", "completed",
    ]
    for stage in expected_stages:
        assert stage in stage_counts, f"Stage missing from counts: {stage}"


def test_velocity_conversion_fields(admin_client):
    resp = admin_client.get("/api/reports/velocity")
    conversion = resp.json()["conversion"]
    for field in ("total_pitches", "advanced_to_assessment", "declined", "parked", "completed"):
        assert field in conversion


def test_velocity_recent_activity_fields(admin_client):
    resp = admin_client.get("/api/reports/velocity")
    recent = resp.json()["recent_30_days"]
    for field in ("pitches_added", "meetings_logged", "assessments_created", "stage_changes"):
        assert field in recent


# --- CSV exports ---

def test_export_pitches_csv(admin_client):
    resp = admin_client.get("/api/reports/export/pitches")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    content = resp.text
    # CSV header must contain pitch fields
    assert "Title" in content
    assert "Stage" in content


def test_export_organisations_csv(admin_client):
    resp = admin_client.get("/api/reports/export/organisations")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Name" in resp.text


def test_export_contacts_csv(admin_client):
    resp = admin_client.get("/api/reports/export/contacts")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]


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
    assert resp.status_code in (401, 403)
