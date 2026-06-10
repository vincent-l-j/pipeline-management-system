"""Tests for /api/contacts CRUD, RBAC, and org linking."""


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


def test_viewer_cannot_delete_contact(admin_client, viewer_client):
    create = admin_client.post("/api/contacts", json={"name": "Protected Contact"})
    contact_id = create.json()["id"]

    resp = viewer_client.delete(f"/api/contacts/{contact_id}")
    assert resp.status_code == 403
