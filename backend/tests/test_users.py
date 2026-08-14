"""Tests for /api/users endpoints and RBAC."""

import pytest

from tests.constants import DENIED, UNKNOWN_ID


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
    resp = admin_client.get(f"/api/users/{UNKNOWN_ID}")
    assert resp.status_code == 404


# --- RBAC: the staff endpoints are admin-only ---
#
# Every admin-only operation on /api/users, crossed with the two roles that must
# not reach it. Written as a grid so the pairing is exhaustive by construction:
# as a list of separate tests this was missing the assessor/update cell, and the
# staff listing is an info-disclosure surface where a gap matters.


def _list_users(client):
    return client.get("/api/users")


def _get_user(client):
    return client.get(f"/api/users/{UNKNOWN_ID}")


def _create_user(client):
    return client.post(
        "/api/users",
        json={"email": "blocked@example.com", "display_name": "Blocked", "role": "viewer"},
    )


def _update_user(client):
    return client.patch(f"/api/users/{UNKNOWN_ID}", json={"display_name": "Nope"})


ADMIN_ONLY_OPERATIONS = {
    "list": _list_users,
    "get": _get_user,
    "create": _create_user,
    "update": _update_user,
}


@pytest.mark.parametrize("role", ["viewer", "assessor"])
@pytest.mark.parametrize("operation", sorted(ADMIN_ONLY_OPERATIONS))
def test_non_admin_cannot_reach_staff_endpoints(request, role, operation):
    client = request.getfixturevalue(f"{role}_client")
    assert ADMIN_ONLY_OPERATIONS[operation](client).status_code == DENIED


def test_unauthenticated_list_users_is_rejected(client):
    resp = client.get("/api/users")
    assert resp.status_code == 403


# --- User directory (minimal, available to any authenticated user) ---


@pytest.mark.parametrize("role", ["viewer", "assessor", "admin"])
def test_any_authenticated_role_can_read_directory(request, role):
    """Unlike the staff listing, the directory is open to every role — the
    lead picker needs it, and it exposes only id + display_name."""
    client = request.getfixturevalue(f"{role}_client")
    resp = client.get("/api/users/directory")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


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
    assert resp.status_code == 403


def test_viewer_can_still_get_me(viewer_client):
    resp = viewer_client.get("/api/users/me")
    assert resp.status_code == 200
    assert resp.json()["role"] == "viewer"
