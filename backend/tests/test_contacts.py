"""Tests for /api/contacts CRUD, RBAC, and org linking."""

from uuid import UUID

import pytest

from tests.constants import ALLOWED, DENIED, UNKNOWN_ID


def test_delete_contact_cascade_removes_join_rows(admin_client, db_session):
    """Deleting a contact removes its PitchContact and MeetingAttendee join rows
    in the same transaction; the parent pitch and meeting survive."""
    from app.models.meeting import MeetingAttendee
    from app.models.pitch import PitchContact

    contact_id = admin_client.post(
        "/api/contacts", json={"first_name": "Joined", "last_name": "Contact"}
    ).json()["id"]
    pitch_id = admin_client.post("/api/pitches", json={"title": "Pitch With Contact"}).json()["id"]
    meeting_id = admin_client.post(
        "/api/meetings",
        json={"title": "Kickoff", "meeting_date": "2026-01-01", "pitch_id": pitch_id},
    ).json()["id"]

    # PitchContact has no create endpoint — insert the join row directly.
    db_session.add(PitchContact(pitch_id=UUID(pitch_id), contact_id=UUID(contact_id)))
    db_session.commit()

    # MeetingAttendee via the API.
    att = admin_client.post(
        f"/api/meetings/{meeting_id}/attendees",
        json={"contact_id": contact_id, "is_internal": False},
    )
    assert att.status_code == 200

    resp = admin_client.delete(f"/api/contacts/{contact_id}")
    assert resp.status_code == 200
    assert admin_client.get(f"/api/contacts/{contact_id}").status_code == 404

    # No dangling join rows remain.
    db_session.expire_all()
    assert (
        db_session.query(PitchContact).filter(PitchContact.contact_id == UUID(contact_id)).count()
        == 0
    )
    assert (
        db_session.query(MeetingAttendee)
        .filter(MeetingAttendee.contact_id == UUID(contact_id))
        .count()
        == 0
    )

    # Parent pitch and meeting remain retrievable.
    assert admin_client.get(f"/api/pitches/{pitch_id}").status_code == 200
    assert admin_client.get(f"/api/meetings/{meeting_id}").status_code == 200


def test_delete_unknown_contact_returns_404(admin_client):
    resp = admin_client.delete(f"/api/contacts/{UNKNOWN_ID}")
    assert resp.status_code == 404


def test_list_contacts_authenticated(admin_client):
    resp = admin_client.get("/api/contacts")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_contact_minimal(admin_client):
    resp = admin_client.post("/api/contacts", json={"first_name": "Jane", "last_name": "Doe"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Jane"
    assert body["last_name"] == "Doe"
    assert "id" in body


def test_create_contact_without_last_name(admin_client):
    """Both name parts are optional — a mononymous contact is storable."""
    resp = admin_client.post("/api/contacts", json={"first_name": "Prince"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Prince"
    assert body["last_name"] is None


def test_create_contact_without_first_name(admin_client):
    """A contact known only by surname is storable too."""
    resp = admin_client.post("/api/contacts", json={"last_name": "Ashworth"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] is None
    assert body["last_name"] == "Ashworth"


def test_create_nameless_contact_with_other_details(admin_client):
    """A nameless contact is fine as long as something identifies it."""
    resp = admin_client.post(
        "/api/contacts", json={"email": "nameless@example.com", "phone": "555"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] is None
    assert body["last_name"] is None
    assert body["email"] == "nameless@example.com"


def test_create_contact_drops_legacy_name_field(admin_client):
    """`name` is gone from the schema — the allowlist drops it rather than
    persisting it under either new column."""
    resp = admin_client.post(
        "/api/contacts", json={"name": "Legacy Payload", "email": "legacy@example.com"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "name" not in body
    assert body["first_name"] is None
    assert body["last_name"] is None
    assert body["email"] == "legacy@example.com"


def test_create_contact_drops_last_contacted(admin_client):
    """`last_contacted` was removed — the allowlist drops it on the way in, and it
    is absent from the response rather than returned as null."""
    resp = admin_client.post(
        "/api/contacts",
        json={"email": "dropped@example.com", "last_contacted": "2026-01-01"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "last_contacted" not in body
    assert body["email"] == "dropped@example.com"


# --- A contact needs at least one populated field ---


def test_create_empty_contact_is_rejected(admin_client):
    resp = admin_client.post("/api/contacts", json={})
    assert resp.status_code == 422


def test_create_contact_with_only_dropped_fields_is_rejected(admin_client):
    """Every field here is outside the allowlist, so nothing survives to store."""
    resp = admin_client.post("/api/contacts", json={"name": "Legacy Only", "bogus": "x"})
    assert resp.status_code == 422


def test_create_contact_with_only_blank_strings_is_rejected(admin_client):
    """Whitespace is not a value — a blank first name leaves the row empty."""
    resp = admin_client.post("/api/contacts", json={"first_name": "   ", "last_name": ""})
    assert resp.status_code == 422


def test_patch_cannot_empty_every_field(admin_client):
    """Clearing the last populated field is refused, and the row is untouched."""
    contact_id = admin_client.post("/api/contacts", json={"first_name": "Solo"}).json()["id"]

    resp = admin_client.patch(f"/api/contacts/{contact_id}", json={"first_name": None})
    assert resp.status_code == 422
    assert admin_client.get(f"/api/contacts/{contact_id}").json()["first_name"] == "Solo"


def test_patch_can_clear_a_field_while_others_remain(admin_client):
    contact_id = admin_client.post(
        "/api/contacts", json={"first_name": "Clearable", "email": "keep@example.com"}
    ).json()["id"]

    resp = admin_client.patch(f"/api/contacts/{contact_id}", json={"first_name": None})
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] is None
    assert body["email"] == "keep@example.com"


def test_create_contact_with_email(admin_client):
    resp = admin_client.post(
        "/api/contacts",
        json={
            "first_name": "Bob",
            "last_name": "Smith",
            "email": "bob@example.com",
            "role": "CTO",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "bob@example.com"
    assert body["role"] == "CTO"


def test_create_contact_linked_to_org(admin_client):
    org = admin_client.post("/api/organisations", json={"name": "Contact Test Org"}).json()
    org_id = org["id"]

    resp = admin_client.post(
        "/api/contacts",
        json={"first_name": "Org", "last_name": "Contact", "organisation_id": org_id},
    )
    assert resp.status_code == 200
    assert resp.json()["organisation_id"] == org_id


def test_get_contact(admin_client):
    create = admin_client.post("/api/contacts", json={"first_name": "Alice", "last_name": "Anders"})
    contact_id = create.json()["id"]

    resp = admin_client.get(f"/api/contacts/{contact_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Alice"
    assert body["last_name"] == "Anders"


def test_update_contact(admin_client):
    create = admin_client.post(
        "/api/contacts", json={"first_name": "Original", "last_name": "Name"}
    )
    contact_id = create.json()["id"]

    resp = admin_client.patch(
        f"/api/contacts/{contact_id}", json={"first_name": "Updated", "last_name": "Surname"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Updated"
    assert body["last_name"] == "Surname"


def test_delete_contact(admin_client):
    create = admin_client.post(
        "/api/contacts", json={"first_name": "Delete", "last_name": "Me Contact"}
    )
    contact_id = create.json()["id"]

    resp = admin_client.delete(f"/api/contacts/{contact_id}")
    assert resp.status_code == 200

    resp = admin_client.get(f"/api/contacts/{contact_id}")
    assert resp.status_code == 404


def test_get_nonexistent_contact(admin_client):
    resp = admin_client.get(f"/api/contacts/{UNKNOWN_ID}")
    assert resp.status_code == 404


# --- RBAC: which roles may read, create and delete ---
#
# One row per (role, operation) cell rather than a test per cell, so a new
# operation is a row and a gap in the grid is visible. Admin is covered by the
# CRUD tests above; PATCH keeps its own tests below because they assert on the
# response body and the untouched row, not just the status.


def _list_contacts(client):
    return client.get("/api/contacts")


def _create_contact(client):
    return client.post("/api/contacts", json={"first_name": "Rbac", "last_name": "Contact"})


def _delete_contact(client):
    return client.delete(f"/api/contacts/{UNKNOWN_ID}")


CONTACT_OPERATIONS = {
    "list": _list_contacts,
    "create": _create_contact,
    "delete": _delete_contact,
}


@pytest.mark.parametrize(
    ("role", "operation", "expected"),
    [
        ("assessor", "list", ALLOWED),
        ("assessor", "create", ALLOWED),
        ("assessor", "delete", DENIED),
        ("viewer", "list", ALLOWED),
        ("viewer", "create", DENIED),
        ("viewer", "delete", DENIED),
    ],
)
def test_contact_rbac(request, role, operation, expected):
    client = request.getfixturevalue(f"{role}_client")
    assert CONTACT_OPERATIONS[operation](client).status_code == expected


# --- PATCH /api/contacts/{id}: partial update, allowlist, RBAC ---


def test_patch_contact_is_partial_update_preserving_omitted_fields(admin_client):
    """Changing one field leaves the others intact."""
    created = admin_client.post(
        "/api/contacts",
        json={
            "first_name": "Partial",
            "last_name": "Keeper",
            "email": "keep@example.com",
            "phone": "12345",
            "notes": "keep me",
        },
    ).json()
    contact_id = created["id"]

    resp = admin_client.patch(f"/api/contacts/{contact_id}", json={"first_name": "Renamed"})
    assert resp.status_code == 200

    fetched = admin_client.get(f"/api/contacts/{contact_id}").json()
    assert fetched["first_name"] == "Renamed"
    assert fetched["last_name"] == "Keeper"
    assert fetched["email"] == "keep@example.com"
    assert fetched["phone"] == "12345"
    assert fetched["notes"] == "keep me"


def test_patch_last_name_only_preserves_first_name(admin_client):
    created = admin_client.post(
        "/api/contacts", json={"first_name": "Jane", "last_name": "Doe"}
    ).json()

    resp = admin_client.patch(f"/api/contacts/{created['id']}", json={"last_name": "Smith"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Jane"
    assert body["last_name"] == "Smith"


def test_patch_can_clear_either_name_part(admin_client):
    created = admin_client.post(
        "/api/contacts",
        json={"first_name": "Jane", "last_name": "Doe", "email": "jane@example.com"},
    ).json()

    resp = admin_client.patch(f"/api/contacts/{created['id']}", json={"last_name": None})
    assert resp.status_code == 200
    assert resp.json()["last_name"] is None

    resp = admin_client.patch(f"/api/contacts/{created['id']}", json={"first_name": None})
    assert resp.status_code == 200
    assert resp.json()["first_name"] is None


def test_assessor_can_patch_contact_rbac(assessor_client):
    contact_id = assessor_client.post(
        "/api/contacts", json={"first_name": "Assessor", "last_name": "Editable"}
    ).json()["id"]
    resp = assessor_client.patch(f"/api/contacts/{contact_id}", json={"role": "Advisor"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "Advisor"


def test_viewer_cannot_patch_contact_rbac(admin_client, viewer_client):
    """Edit is admin/assessor only; a viewer is rejected server-side."""
    contact_id = admin_client.post(
        "/api/contacts", json={"first_name": "Viewer", "last_name": "No Edit"}
    ).json()["id"]
    resp = viewer_client.patch(f"/api/contacts/{contact_id}", json={"first_name": "Hacked"})
    assert resp.status_code == 403
    # The row is untouched.
    assert admin_client.get(f"/api/contacts/{contact_id}").json()["first_name"] == "Viewer"


def test_unauthenticated_patch_contact_is_rejected(client):
    resp = client.patch(f"/api/contacts/{UNKNOWN_ID}", json={"first_name": "Nope"})
    assert resp.status_code == 403


def test_patch_unknown_contact_returns_404(admin_client):
    resp = admin_client.patch(f"/api/contacts/{UNKNOWN_ID}", json={"first_name": "Ghost"})
    assert resp.status_code == 404


def test_patch_contact_ignores_fields_outside_allowlist(admin_client):
    """ContactUpdate is an allowlist — non-client-settable fields are dropped, not persisted."""
    created = admin_client.post(
        "/api/contacts", json={"first_name": "Allowlisted", "last_name": "One"}
    ).json()
    contact_id = created["id"]
    original_created_at = created["created_at"]

    resp = admin_client.patch(
        f"/api/contacts/{contact_id}",
        json={
            "first_name": "Allowlisted 2",
            "name": "Legacy Name",
            "last_contacted": "2026-01-01",
            "created_at": "1999-01-01T00:00:00",
            "bogus": "x",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Allowlisted 2"
    assert body["created_at"] == original_created_at
    assert "bogus" not in body
    assert "name" not in body
    assert "last_contacted" not in body
