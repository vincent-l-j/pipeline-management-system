"""Tests for /api/meetings CRUD, attendees, filters, and AI note parsing."""

import pytest

from tests.constants import DENIED, UNKNOWN_ID


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


def test_delete_meeting_removes_its_attendees(admin_client, db_session):
    """Attendees belong to their meeting — deleting the meeting takes them with it,
    rather than leaving them behind with a dangling meeting_id."""
    from uuid import UUID

    from app.models.meeting import MeetingAttendee

    pitch_id = _create_pitch(admin_client)
    meeting_id = admin_client.post(
        "/api/meetings",
        json={
            "title": "Meeting With Attendees",
            "meeting_date": "2026-06-15",
            "pitch_id": pitch_id,
        },
    ).json()["id"]
    contact_id = admin_client.post(
        "/api/contacts", json={"first_name": "Meeting", "last_name": "Attendee"}
    ).json()["id"]
    assert (
        admin_client.post(
            f"/api/meetings/{meeting_id}/attendees",
            json={"contact_id": contact_id, "is_internal": False},
        ).status_code
        == 200
    )

    assert admin_client.delete(f"/api/meetings/{meeting_id}").status_code == 200

    db_session.expire_all()
    assert db_session.query(MeetingAttendee).filter_by(meeting_id=UUID(meeting_id)).count() == 0
    # The contact themself survives.
    assert admin_client.get(f"/api/contacts/{contact_id}").status_code == 200


def test_get_nonexistent_meeting(admin_client):
    resp = admin_client.get(f"/api/meetings/{UNKNOWN_ID}")
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
        json={
            "title": "Remove Attendee Meeting",
            "meeting_date": "2026-07-02",
            "pitch_id": pitch_id,
        },
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


# Every write a role must not reach. The guard runs before the handler looks
# anything up, so an unknown id still yields 403 rather than 404 — which is what
# makes a single grid enough. The allowed paths need real rows, so they stay as
# their own tests below.


def _create_meeting(client):
    return client.post(
        "/api/meetings",
        json={"title": "Blocked", "meeting_date": "2026-07-10", "pitch_id": UNKNOWN_ID},
    )


def _patch_meeting(client):
    return client.patch(f"/api/meetings/{UNKNOWN_ID}", json={"title": "Hacked"})


def _delete_meeting(client):
    return client.delete(f"/api/meetings/{UNKNOWN_ID}")


MEETING_WRITES = {
    "create": _create_meeting,
    "patch": _patch_meeting,
    "delete": _delete_meeting,
}


@pytest.mark.parametrize(
    ("role", "operation"),
    [
        ("viewer", "create"),
        ("viewer", "patch"),
        ("viewer", "delete"),
        # Delete is admin-only, so an assessor is refused here but not above.
        ("assessor", "delete"),
    ],
)
def test_meeting_write_is_refused(request, role, operation):
    client = request.getfixturevalue(f"{role}_client")
    assert MEETING_WRITES[operation](client).status_code == DENIED


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
