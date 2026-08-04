"""Tests for authentication — protected endpoints reject unauthenticated requests."""
import pytest


PROTECTED_ENDPOINTS = [
    ("GET", "/api/pitches"),
    ("GET", "/api/organisations"),
    ("GET", "/api/contacts"),
    ("GET", "/api/meetings"),
    ("GET", "/api/assessments"),
    ("GET", "/api/users"),
    ("GET", "/api/users/me"),
    ("GET", "/api/reports/pipeline-summary"),
    ("GET", "/api/reports/velocity"),
    ("GET", "/api/reports/export/pitches"),
]


@pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
def test_unauthenticated_request_rejected(client, method, path):
    """Every protected endpoint must return 401 or 403, never 200, without a token."""
    resp = client.request(method, path)
    assert resp.status_code in (401, 403), (
        f"{method} {path} returned {resp.status_code} — expected auth rejection"
    )


def test_health_endpoint_is_public(client):
    """Health check must be reachable without auth."""
    resp = client.get("/api/health")
    assert resp.status_code == 200


def test_auth_login_redirects(client):
    """/auth/login should redirect to the Microsoft OAuth URL."""
    from unittest.mock import MagicMock, patch

    mock_msal_app = MagicMock()
    mock_msal_app.get_authorization_request_url.return_value = (
        "https://login.microsoftonline.com/fake-tenant/oauth2/v2.0/authorize?client_id=fake"
    )

    with patch("app.api.routes.auth._build_msal_app", return_value=mock_msal_app):
        resp = client.get("/api/auth/login")

    assert resp.status_code in (302, 307)
    assert "microsoftonline" in resp.headers.get("location", "")


def test_auth_callback_assigns_contributor_to_new_users(client, db_session):
    """New non-admin users should be assigned the contributor role."""
    from unittest.mock import MagicMock, patch
    from app.models.user import User

    mock_msal_app = MagicMock()
    mock_msal_app.acquire_token_by_authorization_code.return_value = {
        "id_token_claims": {
            "preferred_username": "newuser@rozettainstitute.com",
            "name": "New User",
            "oid": "fake-oid-123",
        }
    }

    with patch("app.api.routes.auth._build_msal_app", return_value=mock_msal_app):
        resp = client.get("/api/auth/callback?code=fake-code")

    assert resp.status_code in (302, 307)

    # Verify the user was created with the contributor role
    user = db_session.query(User).filter(User.email == "newuser@rozettainstitute.com").first()
    assert user is not None
    assert user.role.value == "contributor"


def test_auth_callback_assigns_admin_to_admin_emails(client, db_session):
    """Users in ADMIN_EMAILS should be assigned the admin role."""
    from unittest.mock import MagicMock, patch
    from app.models.user import User

    mock_msal_app = MagicMock()
    admin_email = "admin@rozettainstitute.com"
    mock_msal_app.acquire_token_by_authorization_code.return_value = {
        "id_token_claims": {
            "preferred_username": admin_email,
            "name": "Admin User",
            "oid": "fake-oid-admin",
        }
    }

    with patch("app.api.routes.auth._build_msal_app", return_value=mock_msal_app):
        with patch("app.core.config.settings.ADMIN_EMAILS", admin_email):
            resp = client.get("/api/auth/callback?code=fake-code")

    assert resp.status_code in (302, 307)

    # Verify the user was created with the admin role
    user = db_session.query(User).filter(User.email == admin_email).first()
    assert user is not None
    assert user.role.value == "admin"
