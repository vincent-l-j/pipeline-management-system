"""Tests for /api/search full-text search across all record types."""


def test_search_requires_auth(client):
    resp = client.get("/api/search?q=test")
    assert resp.status_code in (401, 403)


def test_search_returns_all_categories(admin_client):
    resp = admin_client.get("/api/search?q=xx")
    assert resp.status_code == 200
    body = resp.json()
    for key in ("pitches", "organisations", "contacts", "meetings", "assessments", "total"):
        assert key in body


def test_search_finds_pitch_by_title(admin_client):
    admin_client.post("/api/pitches", json={"title": "UniqueSearchablePitch2026"})

    resp = admin_client.get("/api/search?q=UniqueSearchablePitch2026")
    assert resp.status_code == 200
    pitches = resp.json()["pitches"]
    assert any("UniqueSearchablePitch2026" in p["title"] for p in pitches)


def test_search_finds_organisation_by_name(admin_client):
    admin_client.post("/api/organisations", json={"name": "SearchableOrgName2026"})

    resp = admin_client.get("/api/search?q=SearchableOrgName2026")
    assert resp.status_code == 200
    orgs = resp.json()["organisations"]
    assert any("SearchableOrgName2026" in o["title"] for o in orgs)


def test_search_finds_contact_by_name(admin_client):
    admin_client.post("/api/contacts", json={"name": "SearchableContactName2026"})

    resp = admin_client.get("/api/search?q=SearchableContactName2026")
    assert resp.status_code == 200
    contacts = resp.json()["contacts"]
    assert any("SearchableContactName2026" in c["title"] for c in contacts)


def test_search_total_matches_sum(admin_client):
    resp = admin_client.get("/api/search?q=test")
    body = resp.json()
    category_sum = sum(
        len(body[k]) for k in ("pitches", "organisations", "contacts", "meetings", "assessments")
    )
    assert body["total"] == category_sum


def test_search_query_too_short_rejected(admin_client):
    # min_length=2 on the query param
    resp = admin_client.get("/api/search?q=x")
    assert resp.status_code == 422


def test_search_no_results_for_nonsense(admin_client):
    resp = admin_client.get("/api/search?q=zzznomatchxyzqwerty")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
