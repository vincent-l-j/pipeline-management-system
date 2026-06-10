"""Tests for /api/meetings CRUD, attendees, filters, and AI note parsing."""
from unittest.mock import patch


def _create_pitch(client):
    return client.post("/api/pitches", json={"title": "Meeting Test Pitch"}).json()["id"]


MEETING_PAYLOAD = {
    "title": "Kickoff Meeting",
    "meeting_date": "2026-06-01",
    "platform": "zoom",
}


# --- CRUD ---

def test_create_meeting(admin_client):
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post(
        "/api/meetings",
        json={**MEETING_PAYLOAD, "pitch_id": pitch_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Kickoff Meeting"
    assert body["pitch_id"] == pitch_id


def test_list_meetings(admin_client):
    resp = admin_client.get("/api/meetings")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_meeting(admin_client):
    pitch_id = _create_pitch(admin_client)
    create = admin_client.post(
        "/api/meetings",
        json={"title": "Deep Dive", "meeting_date": "2026-06-10", "pitch_id": pitch_id},
    )
    meeting_id = create.json()["id"]

    resp = admin_client.get(f"/api/meetings/{meeting_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Deep Dive"


def test_update_meeting(admin_client):
    pitch_id = _create_pitch(admin_client)
    create = admin_client.post(
        "/api/meetings",
        json={"title": "Old Title", "meeting_date": "2026-06-05", "pitch_id": pitch_id},
    )
    meeting_id = create.json()["id"]

    resp = admin_client.patch(f"/api/meetings/{meeting_id}", json={"title": "New Title"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"


def test_delete_meeting(admin_client):
    pitch_id = _create_pitch(admin_client)
    create = admin_client.post(
        "/api/meetings",
        json={"title": "Delete This Meeting", "meeting_date": "2026-06-15", "pitch_id": pitch_id},
    )
    meeting_id = create.json()["id"]

    resp = admin_client.delete(f"/api/meetings/{meeting_id}")
    assert resp.status_code == 200

    resp = admin_client.get(f"/api/meetings/{meeting_id}")
    assert resp.status_code == 404


def test_get_nonexistent_meeting(admin_client):
    resp = admin_client.get("/api/meetings/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


# --- Filter by pitch_id ---

def test_filter_meetings_by_pitch(admin_client):
    pitch_id = _create_pitch(admin_client)
    admin_client.post(
        "/api/meetings",
        json={"title": "Filtered Meeting", "meeting_date": "2026-06-20", "pitch_id": pitch_id},
    )

    resp = admin_client.get(f"/api/meetings?pitch_id={pitch_id}")
    assert resp.status_code == 200
    meetings = resp.json()
    assert all(m["pitch_id"] == pitch_id for m in meetings)
    assert any(m["title"] == "Filtered Meeting" for m in meetings)


# --- Attendees ---

def test_add_and_list_attendees(admin_client):
    pitch_id = _create_pitch(admin_client)
    meeting = admin_client.post(
        "/api/meetings",
        json={"title": "Attendee Meeting", "meeting_date": "2026-07-01", "pitch_id": pitch_id},
    ).json()
    meeting_id = meeting["id"]

    add_resp = admin_client.post(
        f"/api/meetings/{meeting_id}/attendees",
        json={"is_internal": True},
    )
    assert add_resp.status_code == 200

    list_resp = admin_client.get(f"/api/meetings/{meeting_id}/attendees")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1


def test_remove_attendee(admin_client):
    pitch_id = _create_pitch(admin_client)
    meeting = admin_client.post(
        "/api/meetings",
        json={"title": "Remove Attendee Meeting", "meeting_date": "2026-07-02", "pitch_id": pitch_id},
    ).json()
    meeting_id = meeting["id"]

    attendee = admin_client.post(
        f"/api/meetings/{meeting_id}/attendees",
        json={"is_internal": True},
    ).json()
    attendee_id = attendee["id"]

    resp = admin_client.delete(f"/api/meetings/{meeting_id}/attendees/{attendee_id}")
    assert resp.status_code == 200

    list_resp = admin_client.get(f"/api/meetings/{meeting_id}/attendees")
    assert len(list_resp.json()) == 0


# --- AI note parsing ---

def test_parse_notes_mock(admin_client):
    """parse-notes returns structured fields (using mock parser — no API key)."""
    raw = """
    Summary: Discussed the prototype results.
    Key points:
    - Strong initial data
    - Need more field testing
    Action items:
    - John: arrange field test by July
    """
    resp = admin_client.post("/api/meetings/parse-notes", json={"raw_notes": raw})
    assert resp.status_code == 200
    body = resp.json()
    assert "summary" in body
    assert "key_points" in body
    assert "action_items" in body
    assert "attendees" in body
    assert isinstance(body["key_points"], list)


def test_parse_notes_empty_rejected(admin_client):
    resp = admin_client.post("/api/meetings/parse-notes", json={"raw_notes": "   "})
    assert resp.status_code == 400


# --- RBAC ---

def test_viewer_cannot_create_meeting(viewer_client):
    fake_pitch_id = "00000000-0000-0000-0000-000000000099"
    resp = viewer_client.post(
        "/api/meetings",
        json={"title": "Blocked", "meeting_date": "2026-07-10", "pitch_id": fake_pitch_id},
    )
    assert resp.status_code == 403


def test_viewer_can_list_meetings(viewer_client):
    resp = viewer_client.get("/api/meetings")
    assert resp.status_code == 200


def test_assessor_can_create_meeting(assessor_client):
    pitch_id = _create_pitch(assessor_client)
    resp = assessor_client.post(
        "/api/meetings",
        json={"title": "Assessor Meeting", "meeting_date": "2026-07-15", "pitch_id": pitch_id},
    )
    assert resp.status_code == 200
