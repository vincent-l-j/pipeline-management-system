"""Tests for /api/organisations CRUD and RBAC."""

import pytest

from tests.constants import ALLOWED, DENIED, UNKNOWN_ID

ORG_PAYLOAD = {"name": "Soil Tech Labs", "sector": "Agriculture"}


def test_delete_organisation_orphans_children_not_deletes_them(admin_client):
    """Deleting an org drops its contact affiliations and nulls organisation_id on
    child pitches, but leaves those records in place."""
    org_id = admin_client.post("/api/organisations", json={"name": "Parent Org"}).json()["id"]
    contact_id = admin_client.post(
        "/api/contacts",
        json={"first_name": "Linked", "last_name": "Contact", "organisation_ids": [org_id]},
    ).json()["id"]
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Linked Pitch", "organisation_id": org_id}
    ).json()["id"]

    resp = admin_client.delete(f"/api/organisations/{org_id}")
    assert resp.status_code == 200

    # Organisation itself is gone.
    assert admin_client.get(f"/api/organisations/{org_id}").status_code == 404

    # Children survive with their organisation link cleared (no dangling FK).
    contact = admin_client.get(f"/api/contacts/{contact_id}")
    assert contact.status_code == 200
    assert contact.json()["organisation_ids"] == []

    pitch = admin_client.get(f"/api/pitches/{pitch_id}")
    assert pitch.status_code == 200
    assert pitch.json()["organisation_id"] is None


def test_delete_organisation_keeps_a_contacts_other_affiliations(admin_client):
    """Only the deleted organisation's affiliation goes; the rest of a
    multi-organisation contact is untouched."""
    doomed_id = admin_client.post("/api/organisations", json={"name": "Doomed Org"}).json()["id"]
    kept_id = admin_client.post("/api/organisations", json={"name": "Kept Org"}).json()["id"]
    contact_id = admin_client.post(
        "/api/contacts",
        json={"first_name": "Dual", "organisation_ids": [doomed_id, kept_id]},
    ).json()["id"]

    assert admin_client.delete(f"/api/organisations/{doomed_id}").status_code == 200

    contact = admin_client.get(f"/api/contacts/{contact_id}")
    assert contact.status_code == 200
    assert contact.json()["organisation_ids"] == [kept_id]


def test_delete_unknown_organisation_returns_404(admin_client):
    resp = admin_client.delete(f"/api/organisations/{UNKNOWN_ID}")
    assert resp.status_code == 404


def test_list_organisations_authenticated(admin_client):
    resp = admin_client.get("/api/organisations")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_organisation(admin_client):
    resp = admin_client.post("/api/organisations", json=ORG_PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Soil Tech Labs"
    assert "id" in body


def test_get_organisation(admin_client):
    create = admin_client.post("/api/organisations", json={"name": "Reef Research"})
    org_id = create.json()["id"]

    resp = admin_client.get(f"/api/organisations/{org_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Reef Research"


def test_update_organisation(admin_client):
    create = admin_client.post("/api/organisations", json={"name": "Old Name"})
    org_id = create.json()["id"]

    resp = admin_client.patch(f"/api/organisations/{org_id}", json={"name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


def test_delete_organisation(admin_client):
    create = admin_client.post("/api/organisations", json={"name": "To Delete Org"})
    org_id = create.json()["id"]

    resp = admin_client.delete(f"/api/organisations/{org_id}")
    assert resp.status_code == 200

    resp = admin_client.get(f"/api/organisations/{org_id}")
    assert resp.status_code == 404


def test_get_nonexistent_organisation(admin_client):
    resp = admin_client.get(f"/api/organisations/{UNKNOWN_ID}")
    assert resp.status_code == 404


# --- RBAC: which roles may read, create and delete ---
#
# One row per (role, operation) cell rather than a test per cell, so a new
# operation is a row and a gap in the grid is visible. Admin is covered by the
# CRUD tests above; PATCH keeps its own tests below because they assert on the
# response body and the untouched row, not just the status.


def _list_organisations(client):
    return client.get("/api/organisations")


def _create_organisation(client):
    return client.post("/api/organisations", json={"name": "Rbac Org"})


def _delete_organisation(client):
    return client.delete(f"/api/organisations/{UNKNOWN_ID}")


ORGANISATION_OPERATIONS = {
    "list": _list_organisations,
    "create": _create_organisation,
    "delete": _delete_organisation,
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
def test_organisation_rbac(request, role, operation, expected):
    client = request.getfixturevalue(f"{role}_client")
    assert ORGANISATION_OPERATIONS[operation](client).status_code == expected


# --- PATCH /api/organisations/{id}: partial update, allowlist, RBAC ---


def test_patch_organisation_is_partial_update_preserving_omitted_fields(admin_client):
    """Changing one field leaves the others intact."""
    created = admin_client.post(
        "/api/organisations",
        json={"name": "Partial Org", "sector": "Energy", "abn": "12345678901", "notes": "keep me"},
    ).json()
    org_id = created["id"]

    resp = admin_client.patch(f"/api/organisations/{org_id}", json={"sector": "Renewables"})
    assert resp.status_code == 200

    fetched = admin_client.get(f"/api/organisations/{org_id}").json()
    assert fetched["sector"] == "Renewables"
    assert fetched["name"] == "Partial Org"
    assert fetched["abn"] == "12345678901"
    assert fetched["notes"] == "keep me"


def test_assessor_can_patch_organisation_rbac(assessor_client):
    org_id = assessor_client.post(
        "/api/organisations", json={"name": "Assessor Editable Org"}
    ).json()["id"]
    resp = assessor_client.patch(
        f"/api/organisations/{org_id}", json={"website": "https://x.example"}
    )
    assert resp.status_code == 200
    assert resp.json()["website"] == "https://x.example"


def test_viewer_cannot_patch_organisation_rbac(admin_client, viewer_client):
    """Edit is admin/assessor only; a viewer is rejected server-side."""
    org_id = admin_client.post("/api/organisations", json={"name": "Viewer No Edit Org"}).json()[
        "id"
    ]
    resp = viewer_client.patch(f"/api/organisations/{org_id}", json={"name": "Hacked Org"})
    assert resp.status_code == 403
    assert admin_client.get(f"/api/organisations/{org_id}").json()["name"] == "Viewer No Edit Org"


def test_unauthenticated_patch_organisation_is_rejected(client):
    resp = client.patch(f"/api/organisations/{UNKNOWN_ID}", json={"name": "Nope"})
    assert resp.status_code == 403


def test_patch_unknown_organisation_returns_404(admin_client):
    resp = admin_client.patch(f"/api/organisations/{UNKNOWN_ID}", json={"name": "Ghost"})
    assert resp.status_code == 404


def test_patch_organisation_ignores_fields_outside_allowlist(admin_client):
    """OrganisationUpdate is an allowlist — non-client-settable fields are dropped, not persisted."""
    created = admin_client.post("/api/organisations", json={"name": "Allowlisted Org"}).json()
    org_id = created["id"]
    original_created_at = created["created_at"]

    resp = admin_client.patch(
        f"/api/organisations/{org_id}",
        json={"name": "Allowlisted Org 2", "created_at": "1999-01-01T00:00:00", "bogus": "x"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Allowlisted Org 2"
    assert body["created_at"] == original_created_at
    assert "bogus" not in body
