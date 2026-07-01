"""Tests for /api/pitches CRUD, stage transitions, file links, and RBAC."""
import pytest


PITCH_PAYLOAD = {"title": "Green Hydrogen Initiative"}


# --- CRUD ---

def test_create_pitch(admin_client):
    resp = admin_client.post("/api/pitches", json=PITCH_PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Green Hydrogen Initiative"
    assert body["current_stage"] == "received"
    assert "id" in body


def test_list_pitches(admin_client):
    resp = admin_client.get("/api/pitches")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_pitch(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Ocean Sensor Network"})
    pitch_id = create.json()["id"]

    resp = admin_client.get(f"/api/pitches/{pitch_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Ocean Sensor Network"


def test_update_pitch(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Draft Title"})
    pitch_id = create.json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"title": "Final Title"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Final Title"


def test_patch_updates_only_supplied_fields_and_preserves_others(admin_client):
    create = admin_client.post(
        "/api/pitches",
        json={"title": "Orig", "short_description": "keep me", "domain_tags": "ag"},
    ).json()
    pid = create["id"]

    resp = admin_client.patch(f"/api/pitches/{pid}", json={"title": "Renamed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Renamed"
    # Omitted fields are preserved (partial update).
    assert body["short_description"] == "keep me"
    assert body["domain_tags"] == "ag"


def test_assessor_can_patch_pitch(assessor_client):
    create = assessor_client.post("/api/pitches", json={"title": "For Assessor"}).json()
    pid = create["id"]

    resp = assessor_client.patch(f"/api/pitches/{pid}", json={"title": "Assessor Edited"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Assessor Edited"


def test_viewer_cannot_patch_pitch(viewer_client):
    # RBAC fires before the DB lookup — a fake UUID still yields 403 (VAL-CROSS-001).
    resp = viewer_client.patch(
        "/api/pitches/00000000-0000-0000-0000-000000000099",
        json={"title": "Nope"},
    )
    assert resp.status_code == 403


def test_patch_unknown_pitch_returns_404(admin_client):
    resp = admin_client.patch(
        "/api/pitches/00000000-0000-0000-0000-000000000099",
        json={"title": "X"},
    )
    assert resp.status_code == 404


def test_unauthenticated_patch_is_rejected(client):
    # HTTPBearer returns 403 for a missing Authorization header; an invalid token
    # yields 401 from get_current_user. Either way the edit is refused.
    resp = client.patch(
        "/api/pitches/00000000-0000-0000-0000-000000000099",
        json={"title": "X"},
    )
    assert resp.status_code in (401, 403)


def test_patch_stage_immutable_leaves_stage_and_writes_no_history(admin_client):
    """current_stage is absent from PitchUpdate, so a PATCH carrying it is ignored:
    the stage is unchanged and no PitchStageHistory row is added (VAL-PITCH-003)."""
    create = admin_client.post("/api/pitches", json={"title": "Immutable Stage"}).json()
    pid = create["id"]
    history_before = admin_client.get(f"/api/pitches/{pid}/history").json()

    resp = admin_client.patch(
        f"/api/pitches/{pid}",
        json={"title": "Edited", "current_stage": "declined"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Edited"
    assert resp.json()["current_stage"] == "received"  # stage unchanged

    history_after = admin_client.get(f"/api/pitches/{pid}/history").json()
    assert len(history_after) == len(history_before)  # no new stage-history row


def test_delete_pitch(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Delete This Pitch"})
    pitch_id = create.json()["id"]

    resp = admin_client.delete(f"/api/pitches/{pitch_id}")
    assert resp.status_code == 200

    resp = admin_client.get(f"/api/pitches/{pitch_id}")
    assert resp.status_code == 404


def test_get_nonexistent_pitch(admin_client):
    resp = admin_client.get("/api/pitches/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


# --- Stage transitions ---

def test_stage_transition(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Stage Test Pitch"})
    pitch_id = create.json()["id"]

    resp = admin_client.post(
        f"/api/pitches/{pitch_id}/stage",
        json={"new_stage": "initial_screen", "note": "Passed initial review"},
    )
    assert resp.status_code == 200
    assert resp.json()["current_stage"] == "initial_screen"


def test_stage_history_recorded(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "History Test Pitch"})
    pitch_id = create.json()["id"]

    admin_client.post(
        f"/api/pitches/{pitch_id}/stage",
        json={"new_stage": "discovery_meeting"},
    )

    resp = admin_client.get(f"/api/pitches/{pitch_id}/history")
    assert resp.status_code == 200
    history = resp.json()
    # At least two entries: initial creation + the transition
    assert len(history) >= 2
    stages = [h["to_stage"] for h in history]
    assert "received" in stages
    assert "discovery_meeting" in stages


def test_stage_transition_on_nonexistent_pitch(admin_client):
    resp = admin_client.post(
        "/api/pitches/00000000-0000-0000-0000-000000000000/stage",
        json={"new_stage": "initial_screen"},
    )
    assert resp.status_code == 404


# --- Filters ---

def test_filter_by_stage(admin_client):
    admin_client.post("/api/pitches", json={"title": "Declined Pitch"})
    pitches = admin_client.get("/api/pitches").json()
    declined_pitch = pitches[0]
    admin_client.post(
        f"/api/pitches/{declined_pitch['id']}/stage",
        json={"new_stage": "declined"},
    )

    resp = admin_client.get("/api/pitches?stage=declined")
    assert resp.status_code == 200
    stages = [p["current_stage"] for p in resp.json()]
    assert all(s == "declined" for s in stages)


# --- File links ---

def test_add_file_link(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "File Link Pitch"})
    pitch_id = create.json()["id"]

    resp = admin_client.post(
        f"/api/pitches/{pitch_id}/files",
        json={"file_path": "/docs/proposal.pdf", "label": "Proposal"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["file_path"] == "/docs/proposal.pdf"
    assert body["label"] == "Proposal"


def test_list_file_links(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "File List Pitch"})
    pitch_id = create.json()["id"]

    admin_client.post(
        f"/api/pitches/{pitch_id}/files",
        json={"file_path": "/docs/a.pdf", "label": "Doc A"},
    )
    admin_client.post(
        f"/api/pitches/{pitch_id}/files",
        json={"file_path": "/docs/b.pdf", "label": "Doc B"},
    )

    resp = admin_client.get(f"/api/pitches/{pitch_id}/files")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# --- Timeline ---

def test_timeline_returns_events(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Timeline Pitch"})
    pitch_id = create.json()["id"]

    resp = admin_client.get(f"/api/pitches/{pitch_id}/timeline")
    assert resp.status_code == 200
    body = resp.json()
    assert "events" in body
    assert "total" in body
    assert isinstance(body["events"], list)


# --- RBAC ---

def test_assessor_can_create_pitch(assessor_client):
    resp = assessor_client.post("/api/pitches", json={"title": "Assessor Pitch"})
    assert resp.status_code == 200


def test_viewer_cannot_create_pitch(viewer_client):
    resp = viewer_client.post("/api/pitches", json={"title": "Should Fail"})
    assert resp.status_code == 403


def test_viewer_can_list_pitches(viewer_client):
    resp = viewer_client.get("/api/pitches")
    assert resp.status_code == 200


def test_viewer_cannot_delete_pitch(viewer_client):
    # RBAC fires before DB lookup — fake UUID is sufficient to test the 403
    resp = viewer_client.delete("/api/pitches/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 403


def test_viewer_cannot_transition_stage(viewer_client):
    resp = viewer_client.post(
        "/api/pitches/00000000-0000-0000-0000-000000000099/stage",
        json={"new_stage": "initial_screen"},
    )
    assert resp.status_code == 403
