"""Tests for /api/contacts CRUD, RBAC, and org linking."""

from uuid import UUID


def test_delete_contact_cascade_removes_join_rows(admin_client, db_session):
    """Deleting a contact removes its PitchContact and MeetingAttendee join rows
    in the same transaction; the parent pitch and meeting survive."""
    from app.models.meeting import MeetingAttendee
    from app.models.pitch import PitchContact

    contact_id = admin_client.post("/api/contacts", json={"name": "Joined Contact"}).json()["id"]
    pitch_id = admin_client.post("/api/pitches", json={"title": "Pitch With Contact"}).json()["id"]
    meeting_id = admin_client.post(
        "/api/meetings",
        json={"title": "Kickoff", "meeting_date": "2026-01-01", "pitch_id": pitch_id},
    ).json()["id"]

    # PitchContact has no create endpoint — insert the join row directly.
    db_session.add(
        PitchContact(pitch_id=UUID(pitch_id), contact_id=UUID(contact_id), role_in_pitch="lead")
    )
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
    resp = admin_client.delete("/api/contacts/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 404


def test_assessor_cannot_delete_contact_rbac(assessor_client):
    """Delete is admin-only; assessor rejected server-side."""
    resp = assessor_client.delete("/api/contacts/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 403


def test_assessor_can_create_contact_rbac(assessor_client):
    resp = assessor_client.post("/api/contacts", json={"name": "Assessor RBAC Contact"})
    assert resp.status_code == 200


def test_viewer_cannot_create_contact_rbac(viewer_client):
    resp = viewer_client.post("/api/contacts", json={"name": "Viewer RBAC Contact"})
    assert resp.status_code == 403


def test_list_contacts_authenticated(admin_client):
    resp = admin_client.get("/api/contacts")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_contact_minimal(admin_client):
    resp = admin_client.post("/api/contacts", json={"name": "Jane Doe"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Jane Doe"
    assert "id" in body


def test_create_contact_with_email(admin_client):
    resp = admin_client.post(
        "/api/contacts",
        json={"name": "Bob Smith", "email": "bob@example.com", "role": "CTO"},
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
        json={"name": "Org Contact", "organisation_id": org_id},
    )
    assert resp.status_code == 200
    assert resp.json()["organisation_id"] == org_id


def test_get_contact(admin_client):
    create = admin_client.post("/api/contacts", json={"name": "Alice"})
    contact_id = create.json()["id"]

    resp = admin_client.get(f"/api/contacts/{contact_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Alice"


def test_update_contact(admin_client):
    create = admin_client.post("/api/contacts", json={"name": "Original Name"})
    contact_id = create.json()["id"]

    resp = admin_client.patch(f"/api/contacts/{contact_id}", json={"name": "Updated Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


def test_delete_contact(admin_client):
    create = admin_client.post("/api/contacts", json={"name": "Delete Me Contact"})
    contact_id = create.json()["id"]

    resp = admin_client.delete(f"/api/contacts/{contact_id}")
    assert resp.status_code == 200

    resp = admin_client.get(f"/api/contacts/{contact_id}")
    assert resp.status_code == 404


def test_get_nonexistent_contact(admin_client):
    resp = admin_client.get("/api/contacts/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_assessor_can_create_contact(assessor_client):
    resp = assessor_client.post("/api/contacts", json={"name": "Assessor Contact"})
    assert resp.status_code == 200


def test_viewer_cannot_create_contact(viewer_client):
    resp = viewer_client.post("/api/contacts", json={"name": "Should Fail"})
    assert resp.status_code == 403


def test_viewer_can_list_contacts(viewer_client):
    resp = viewer_client.get("/api/contacts")
    assert resp.status_code == 200


def test_viewer_cannot_delete_contact(viewer_client):
    resp = viewer_client.delete("/api/contacts/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 403


# --- PATCH /api/contacts/{id}: partial update, allowlist, RBAC ---


def test_patch_contact_is_partial_update_preserving_omitted_fields(admin_client):
    """Changing one field leaves the others intact."""
    created = admin_client.post(
        "/api/contacts",
        json={"name": "Partial", "email": "keep@example.com", "phone": "12345", "notes": "keep me"},
    ).json()
    contact_id = created["id"]

    resp = admin_client.patch(f"/api/contacts/{contact_id}", json={"name": "Partial Renamed"})
    assert resp.status_code == 200

    fetched = admin_client.get(f"/api/contacts/{contact_id}").json()
    assert fetched["name"] == "Partial Renamed"
    assert fetched["email"] == "keep@example.com"
    assert fetched["phone"] == "12345"
    assert fetched["notes"] == "keep me"


def test_assessor_can_patch_contact_rbac(assessor_client):
    contact_id = assessor_client.post("/api/contacts", json={"name": "Assessor Editable"}).json()[
        "id"
    ]
    resp = assessor_client.patch(f"/api/contacts/{contact_id}", json={"role": "Advisor"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "Advisor"


def test_viewer_cannot_patch_contact_rbac(admin_client, viewer_client):
    """Edit is admin/assessor only; a viewer is rejected server-side."""
    contact_id = admin_client.post("/api/contacts", json={"name": "Viewer No Edit"}).json()["id"]
    resp = viewer_client.patch(f"/api/contacts/{contact_id}", json={"name": "Hacked"})
    assert resp.status_code == 403
    # The row is untouched.
    assert admin_client.get(f"/api/contacts/{contact_id}").json()["name"] == "Viewer No Edit"


def test_unauthenticated_patch_contact_is_rejected(client):
    # Missing credentials -> 403 from HTTPBearer; an invalid token -> 401. Either
    # way the edit is refused without a valid session.
    resp = client.patch("/api/contacts/00000000-0000-0000-0000-000000000099", json={"name": "Nope"})
    assert resp.status_code in (401, 403)


def test_patch_unknown_contact_returns_404(admin_client):
    resp = admin_client.patch(
        "/api/contacts/00000000-0000-0000-0000-000000000099", json={"name": "Ghost"}
    )
    assert resp.status_code == 404


def test_patch_contact_ignores_fields_outside_allowlist(admin_client):
    """ContactUpdate is an allowlist — non-client-settable fields are dropped, not persisted."""
    created = admin_client.post("/api/contacts", json={"name": "Allowlisted"}).json()
    contact_id = created["id"]
    original_created_at = created["created_at"]

    resp = admin_client.patch(
        f"/api/contacts/{contact_id}",
        json={"name": "Allowlisted 2", "created_at": "1999-01-01T00:00:00", "bogus": "x"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Allowlisted 2"
    assert body["created_at"] == original_created_at
    assert "bogus" not in body
