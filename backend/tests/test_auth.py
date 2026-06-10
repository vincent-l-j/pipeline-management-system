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
