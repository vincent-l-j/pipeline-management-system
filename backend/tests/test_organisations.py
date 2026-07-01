"""Tests for /api/organisations CRUD and RBAC."""


ORG_PAYLOAD = {"name": "Soil Tech Labs", "sector": "Agriculture"}


def test_delete_organisation_orphans_children_not_deletes_them(admin_client):
    """Deleting an org nulls organisation_id on child contacts and pitches
    but leaves those records in place (VAL-ORG-003)."""
    org_id = admin_client.post("/api/organisations", json={"name": "Parent Org"}).json()["id"]
    contact_id = admin_client.post(
        "/api/contacts", json={"name": "Linked Contact", "organisation_id": org_id}
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
    assert contact.json()["organisation_id"] is None

    pitch = admin_client.get(f"/api/pitches/{pitch_id}")
    assert pitch.status_code == 200
    assert pitch.json()["organisation_id"] is None


def test_delete_unknown_organisation_returns_404(admin_client):
    resp = admin_client.delete("/api/organisations/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 404


def test_assessor_cannot_delete_organisation_rbac(assessor_client):
    """Delete is admin-only; assessor is rejected server-side (VAL-ORG-004, VAL-CROSS-001)."""
    resp = assessor_client.delete("/api/organisations/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 403


def test_assessor_can_create_organisation_rbac(assessor_client):
    resp = assessor_client.post("/api/organisations", json={"name": "Assessor RBAC Org"})
    assert resp.status_code == 200


def test_viewer_cannot_create_organisation_rbac(viewer_client):
    resp = viewer_client.post("/api/organisations", json={"name": "Viewer RBAC Org"})
    assert resp.status_code == 403


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
    resp = admin_client.get("/api/organisations/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_assessor_can_create_organisation(assessor_client):
    resp = assessor_client.post("/api/organisations", json={"name": "Assessor Org"})
    assert resp.status_code == 200


def test_viewer_cannot_create_organisation(viewer_client):
    resp = viewer_client.post("/api/organisations", json={"name": "Should Fail"})
    assert resp.status_code == 403


def test_viewer_can_list_organisations(viewer_client):
    resp = viewer_client.get("/api/organisations")
    assert resp.status_code == 200


def test_viewer_cannot_delete_organisation(viewer_client):
    resp = viewer_client.delete("/api/organisations/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 403
