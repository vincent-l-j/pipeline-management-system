"""Tests for /api/users endpoints and RBAC."""


def test_get_me(admin_client):
    resp = admin_client.get("/api/users/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "tester@rozettainstitute.com"
    assert body["role"] == "admin"


def test_list_users(admin_client):
    resp = admin_client.get("/api/users")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_admin_can_create_user(admin_client):
    resp = admin_client.post(
        "/api/users",
        json={"email": "newuser@example.com", "display_name": "New User", "role": "viewer"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "newuser@example.com"
    assert body["role"] == "viewer"


def test_duplicate_email_rejected(admin_client):
    admin_client.post(
        "/api/users",
        json={"email": "dup@example.com", "display_name": "Dup User", "role": "viewer"},
    )
    resp = admin_client.post(
        "/api/users",
        json={"email": "dup@example.com", "display_name": "Dup Again", "role": "viewer"},
    )
    assert resp.status_code == 400


def test_admin_can_update_user(admin_client):
    create = admin_client.post(
        "/api/users",
        json={"email": "update_target@example.com", "display_name": "Before", "role": "viewer"},
    )
    user_id = create.json()["id"]

    resp = admin_client.patch(f"/api/users/{user_id}", json={"display_name": "After"})
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "After"


def test_get_user_by_id(admin_client):
    create = admin_client.post(
        "/api/users",
        json={"email": "fetchme@example.com", "display_name": "Fetch Me", "role": "viewer"},
    )
    user_id = create.json()["id"]

    resp = admin_client.get(f"/api/users/{user_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == user_id


def test_get_nonexistent_user(admin_client):
    resp = admin_client.get("/api/users/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_viewer_cannot_create_user(viewer_client):
    resp = viewer_client.post(
        "/api/users",
        json={"email": "blocked@example.com", "display_name": "Blocked", "role": "viewer"},
    )
    assert resp.status_code == 403


def test_viewer_cannot_list_users(viewer_client):
    # Staff listing is admin-only — closes the info-disclosure hole (VAL-USERS-003).
    resp = viewer_client.get("/api/users")
    assert resp.status_code == 403


def test_assessor_cannot_list_users(assessor_client):
    resp = assessor_client.get("/api/users")
    assert resp.status_code == 403


def test_assessor_cannot_create_user(assessor_client):
    resp = assessor_client.post(
        "/api/users",
        json={"email": "nope@example.com", "display_name": "Nope", "role": "viewer"},
    )
    assert resp.status_code == 403


def test_viewer_cannot_get_user_by_id(viewer_client):
    resp = viewer_client.get("/api/users/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 403


def test_assessor_cannot_get_user_by_id(assessor_client):
    resp = assessor_client.get("/api/users/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 403


def test_viewer_cannot_update_user(viewer_client):
    resp = viewer_client.patch(
        "/api/users/00000000-0000-0000-0000-000000000099",
        json={"display_name": "Nope"},
    )
    assert resp.status_code == 403


def test_unauthenticated_list_users_is_rejected(client):
    resp = client.get("/api/users")
    assert resp.status_code in (401, 403)


# --- User directory (minimal, available to any authenticated user) ---

def test_viewer_can_read_directory(viewer_client):
    resp = viewer_client.get("/api/users/directory")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_assessor_can_read_directory(assessor_client):
    resp = assessor_client.get("/api/users/directory")
    assert resp.status_code == 200


def test_admin_can_read_directory(admin_client):
    resp = admin_client.get("/api/users/directory")
    assert resp.status_code == 200


def test_directory_entries_expose_only_id_and_display_name(admin_client):
    admin_client.post(
        "/api/users",
        json={"email": "dir@example.com", "display_name": "Directory Person", "role": "assessor"},
    )
    resp = admin_client.get("/api/users/directory")
    assert resp.status_code == 200
    entry = next(e for e in resp.json() if e["display_name"] == "Directory Person")
    # Exactly id + display_name — never email, role, is_active or azure_oid.
    assert set(entry.keys()) == {"id", "display_name"}


def test_unauthenticated_directory_is_rejected(client):
    resp = client.get("/api/users/directory")
    assert resp.status_code in (401, 403)


def test_viewer_can_still_get_me(viewer_client):
    resp = viewer_client.get("/api/users/me")
    assert resp.status_code == 200
    assert resp.json()["role"] == "viewer"
