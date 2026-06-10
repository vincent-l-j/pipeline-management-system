"""Tests for /api/assessments CRUD, auto-versioning, validation, and RBAC."""
import pytest


def _create_pitch(client):
    return client.post("/api/pitches", json={"title": "Assessment Target Pitch"}).json()["id"]


SCORE_PAYLOAD = {
    "national_impact": 4,
    "translation_readiness": 3,
    "team_capability": 5,
    "ecosystem_fit": 4,
    "funding_pathway_clarity": 3,
    "masterplan_alignment": 4,
    "recommendation": "proceed",
    "assessment_date": "2026-06-10",
}


# --- CRUD ---

def test_create_assessment(admin_client):
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["national_impact"] == 4
    assert body["recommendation"] == "proceed"
    assert body["version"] == 1
    assert body["pitch_id"] == pitch_id


def test_list_assessments(admin_client):
    resp = admin_client.get("/api/assessments")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_assessment(admin_client):
    pitch_id = _create_pitch(admin_client)
    create = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    )
    assessment_id = create.json()["id"]

    resp = admin_client.get(f"/api/assessments/{assessment_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == assessment_id


def test_get_nonexistent_assessment(admin_client):
    resp = admin_client.get("/api/assessments/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


# --- Auto-versioning ---

def test_assessment_auto_versioning(admin_client):
    pitch_id = _create_pitch(admin_client)

    first = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()
    second = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()
    third = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()

    assert first["version"] == 1
    assert second["version"] == 2
    assert third["version"] == 3


def test_versions_are_independent_per_pitch(admin_client):
    pitch_a = _create_pitch(admin_client)
    pitch_b = _create_pitch(admin_client)

    a1 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_a}).json()
    b1 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_b}).json()
    a2 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_a}).json()

    assert a1["version"] == 1
    assert b1["version"] == 1
    assert a2["version"] == 2


# --- Score validation ---

@pytest.mark.parametrize("field", [
    "national_impact", "translation_readiness", "team_capability",
    "ecosystem_fit", "funding_pathway_clarity", "masterplan_alignment",
])
def test_score_above_5_rejected(admin_client, field):
    pitch_id = _create_pitch(admin_client)
    payload = {**SCORE_PAYLOAD, "pitch_id": pitch_id, field: 6}
    resp = admin_client.post("/api/assessments", json=payload)
    assert resp.status_code == 422


@pytest.mark.parametrize("field", [
    "national_impact", "translation_readiness", "team_capability",
    "ecosystem_fit", "funding_pathway_clarity", "masterplan_alignment",
])
def test_score_below_1_rejected(admin_client, field):
    pitch_id = _create_pitch(admin_client)
    payload = {**SCORE_PAYLOAD, "pitch_id": pitch_id, field: 0}
    resp = admin_client.post("/api/assessments", json=payload)
    assert resp.status_code == 422


# --- Filter by pitch_id ---

def test_filter_assessments_by_pitch(admin_client):
    pitch_id = _create_pitch(admin_client)
    admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_id})

    resp = admin_client.get(f"/api/assessments?pitch_id={pitch_id}")
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) >= 1
    assert all(a["pitch_id"] == pitch_id for a in results)


# --- RBAC ---

def test_viewer_cannot_create_assessment(viewer_client):
    fake_pitch_id = "00000000-0000-0000-0000-000000000099"
    resp = viewer_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": fake_pitch_id})
    assert resp.status_code == 403


def test_viewer_can_list_assessments(viewer_client):
    resp = viewer_client.get("/api/assessments")
    assert resp.status_code == 200


def test_assessor_can_create_assessment(assessor_client):
    pitch_id = _create_pitch(assessor_client)
    resp = assessor_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_id})
    assert resp.status_code == 200
