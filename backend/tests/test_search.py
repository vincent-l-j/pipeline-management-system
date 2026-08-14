"""Tests for /api/search full-text search across all record types."""


def test_search_requires_auth(client):
    resp = client.get("/api/search?q=test")
    assert resp.status_code == 403


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


def test_search_finds_contact_by_first_name(admin_client):
    admin_client.post(
        "/api/contacts", json={"first_name": "SearchableFirst2026", "last_name": "Nomatchsurname"}
    )

    resp = admin_client.get("/api/search?q=SearchableFirst2026")
    assert resp.status_code == 200
    contacts = resp.json()["contacts"]
    assert any("SearchableFirst2026" in c["title"] for c in contacts)


def test_search_finds_contact_by_last_name(admin_client):
    admin_client.post(
        "/api/contacts", json={"first_name": "Nomatchgiven", "last_name": "SearchableLast2026"}
    )

    resp = admin_client.get("/api/search?q=SearchableLast2026")
    assert resp.status_code == 200
    contacts = resp.json()["contacts"]
    assert any("SearchableLast2026" in c["title"] for c in contacts)


def test_search_finds_contact_by_full_name(admin_client):
    """A query spanning both columns ("Given Family") still matches."""
    admin_client.post("/api/contacts", json={"first_name": "Fullname2026", "last_name": "Match"})

    resp = admin_client.get("/api/search?q=Fullname2026 Match")
    assert resp.status_code == 200
    contacts = resp.json()["contacts"]
    assert any(c["title"] == "Fullname2026 Match" for c in contacts)


def test_search_contact_title_omits_missing_last_name(admin_client):
    """A contact with no last name has no trailing space in its search title."""
    admin_client.post("/api/contacts", json={"first_name": "Mononym2026"})

    resp = admin_client.get("/api/search?q=Mononym2026")
    assert resp.status_code == 200
    contacts = resp.json()["contacts"]
    assert any(c["title"] == "Mononym2026" for c in contacts)


def test_search_contact_title_omits_missing_first_name(admin_client):
    """Same for a surname-only contact — no leading space."""
    admin_client.post("/api/contacts", json={"last_name": "Surnameonly2026"})

    resp = admin_client.get("/api/search?q=Surnameonly2026")
    assert resp.status_code == 200
    contacts = resp.json()["contacts"]
    assert any(c["title"] == "Surnameonly2026" for c in contacts)


def test_search_nameless_contact_falls_back_to_a_label(admin_client):
    """A contact with no name at all still yields a clickable, labelled result."""
    admin_client.post("/api/contacts", json={"role": "Namelessrole2026"})

    resp = admin_client.get("/api/search?q=Namelessrole2026")
    assert resp.status_code == 200
    contacts = resp.json()["contacts"]
    assert any(c["title"] == "Unnamed contact" for c in contacts)


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
