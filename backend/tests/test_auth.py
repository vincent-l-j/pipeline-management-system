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
    """/auth/login should initiate the OAuth flow (redirect or JSON with auth URL)."""
    resp = client.get("/api/auth/login")
    # Either a redirect to Microsoft or a JSON body with the auth URL
    assert resp.status_code in (302, 307, 200)
