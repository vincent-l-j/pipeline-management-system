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


# A request can fail authentication two distinct ways, and they are not
# interchangeable: HTTPBearer(auto_error=True) rejects a *missing* Authorization
# header itself with 403, before any of our code runs, while a header that is
# present but carries a bad token reaches get_current_user and raises 401. Each
# path gets its own test asserting its own code — `in (401, 403)` would pass
# whichever way the request happened to fail, so it could not tell us that the
# header was rejected for the reason we thought.


@pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
def test_request_without_credentials_is_rejected(client, method, path):
    """No Authorization header at all: refused by HTTPBearer with 403."""
    resp = client.request(method, path)
    assert resp.status_code == 403, (
        f"{method} {path} returned {resp.status_code} — expected auth rejection"
    )


@pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
def test_request_with_invalid_token_is_rejected(client, method, path):
    """A well-formed bearer header whose token does not decode: 401."""
    resp = client.request(method, path, headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401, (
        f"{method} {path} returned {resp.status_code} — expected token rejection"
    )


def test_non_bearer_scheme_is_rejected(client):
    """Basic auth is not a supported scheme — HTTPBearer refuses the scheme itself."""
    resp = client.get("/api/pitches", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert resp.status_code == 403


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
