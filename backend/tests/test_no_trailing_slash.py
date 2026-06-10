"""Regression test for the trailing-slash routing bug.

Collection routes are registered WITHOUT a trailing slash (e.g. `/api/pitches`),
matching how the frontend calls them, and `redirect_slashes=False` is set on the
app. Together that means:

  * the no-slash path the frontend uses hits the route directly (here: an auth
    challenge), instead of a 307 redirect, and
  * the trailing-slash variant 404s loudly rather than silently redirecting.

Before the fix, `POST /api/pitches` returned a 307 to `/api/pitches/`. Behind the
dev Vite proxy (changeOrigin: true) that redirect pointed at the unreachable
`backend:8000` host, the request died with no response, and the UI showed the
generic "Failed to create pitch".
"""
import pytest

COLLECTIONS = [
    "/api/pitches",
    "/api/organisations",
    "/api/users",
    "/api/contacts",
    "/api/meetings",
    "/api/assessments",
]


@pytest.mark.parametrize("path", COLLECTIONS)
def test_no_slash_reaches_route_not_redirect(client, path):
    """The no-slash path resolves to the route (auth-rejected), never a 307."""
    resp = client.get(path)
    assert resp.status_code != 307, (
        f"{path} 307-redirected — the trailing-slash bug is back"
    )
    # Route matched and the auth layer rejected us (no bearer token).
    assert resp.status_code in (401, 403)


@pytest.mark.parametrize("path", COLLECTIONS)
def test_trailing_slash_404s(client, path):
    """redirect_slashes=False: the slash variant must 404, not redirect."""
    resp = client.get(path + "/")
    assert resp.status_code == 404


def test_create_pitch_succeeds(admin_client):
    """End-to-end: an authenticated POST to the no-slash path creates a pitch."""
    resp = admin_client.post("/api/pitches", json={"title": "Soil Sensor Initiative"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["title"] == "Soil Sensor Initiative"
    assert body["current_stage"] == "received"
