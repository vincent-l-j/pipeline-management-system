"""Tests for /api/pitches CRUD, stage transitions, file links, and RBAC."""

import pytest

from app.models.pitch import PitchSource

PITCH_PAYLOAD = {"title": "Green Hydrogen Initiative"}


# --- CRUD ---


def test_create_pitch(admin_client):
    resp = admin_client.post("/api/pitches", json=PITCH_PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Green Hydrogen Initiative"
    assert body["current_stage"] == "received"
    assert "id" in body


def test_list_pitches(admin_client):
    resp = admin_client.get("/api/pitches")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_pitch(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Ocean Sensor Network"})
    pitch_id = create.json()["id"]

    resp = admin_client.get(f"/api/pitches/{pitch_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Ocean Sensor Network"


def test_update_pitch(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Draft Title"})
    pitch_id = create.json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"title": "Final Title"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Final Title"


def test_patch_updates_only_supplied_fields_and_preserves_others(admin_client):
    create = admin_client.post(
        "/api/pitches",
        json={"title": "Orig", "short_description": "keep me", "domain_tags": "ag"},
    ).json()
    pid = create["id"]

    resp = admin_client.patch(f"/api/pitches/{pid}", json={"title": "Renamed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Renamed"
    # Omitted fields are preserved (partial update).
    assert body["short_description"] == "keep me"
    assert body["domain_tags"] == "ag"


def test_assessor_can_patch_pitch(assessor_client):
    create = assessor_client.post("/api/pitches", json={"title": "For Assessor"}).json()
    pid = create["id"]

    resp = assessor_client.patch(f"/api/pitches/{pid}", json={"title": "Assessor Edited"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Assessor Edited"


def test_viewer_cannot_patch_pitch(viewer_client):
    # RBAC fires before the DB lookup — a fake UUID still yields 403.
    resp = viewer_client.patch(
        "/api/pitches/00000000-0000-0000-0000-000000000099",
        json={"title": "Nope"},
    )
    assert resp.status_code == 403


def test_patch_unknown_pitch_returns_404(admin_client):
    resp = admin_client.patch(
        "/api/pitches/00000000-0000-0000-0000-000000000099",
        json={"title": "X"},
    )
    assert resp.status_code == 404


def test_unauthenticated_patch_is_rejected(client):
    # HTTPBearer returns 403 for a missing Authorization header; an invalid token
    # yields 401 from get_current_user. Either way the edit is refused.
    resp = client.patch(
        "/api/pitches/00000000-0000-0000-0000-000000000099",
        json={"title": "X"},
    )
    assert resp.status_code in (401, 403)


def test_patch_stage_immutable_leaves_stage_and_writes_no_history(admin_client):
    """current_stage is absent from PitchUpdate, so a PATCH carrying it is ignored:
    the stage is unchanged and no PitchStageHistory row is added."""
    create = admin_client.post("/api/pitches", json={"title": "Immutable Stage"}).json()
    pid = create["id"]
    history_before = admin_client.get(f"/api/pitches/{pid}/history").json()

    resp = admin_client.patch(
        f"/api/pitches/{pid}",
        json={"title": "Edited", "current_stage": "declined"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Edited"
    assert resp.json()["current_stage"] == "received"  # stage unchanged

    history_after = admin_client.get(f"/api/pitches/{pid}/history").json()
    assert len(history_after) == len(history_before)  # no new stage-history row


def test_delete_pitch(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Delete This Pitch"})
    pitch_id = create.json()["id"]

    resp = admin_client.delete(f"/api/pitches/{pitch_id}")
    assert resp.status_code == 200

    resp = admin_client.get(f"/api/pitches/{pitch_id}")
    assert resp.status_code == 404


def test_get_nonexistent_pitch(admin_client):
    resp = admin_client.get("/api/pitches/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


# --- Sources ---


# The source vocabulary as it goes over the wire, oldest first. Mirrored by
# SOURCE_LABELS in frontend/src/components/pipeline/PipelineConfig.ts.
EXPECTED_SOURCES = [
    "referral",
    "website",
    "event",
    "cold_outreach",
    "internal",
    "riac",
    "foundry",
    "board",
    "riac_student",
    "rozetta_network",
]


def test_pitch_source_vocabulary_matches_the_enum():
    """Adding or removing a PitchSource member without updating EXPECTED_SOURCES —
    and the frontend labels and Alembic enum sync that mirror it — fails here."""
    assert [s.value for s in PitchSource] == EXPECTED_SOURCES


@pytest.mark.parametrize("source", EXPECTED_SOURCES)
def test_pitch_source_round_trips(admin_client, source):
    create = admin_client.post("/api/pitches", json={"title": f"Source {source}", "source": source})
    assert create.status_code == 200
    assert create.json()["source"] == source

    fetched = admin_client.get(f"/api/pitches/{create.json()['id']}")
    assert fetched.json()["source"] == source


def test_pitch_source_unknown_value_returns_422(admin_client):
    resp = admin_client.post("/api/pitches", json={"title": "Bad", "source": "not_a_source"})
    assert resp.status_code == 422


# --- Funding pathways ---


@pytest.mark.parametrize("pathway", ["no_funding_identified", "internal_funding"])
def test_funding_pathway_new_value_round_trips(admin_client, pathway):
    create = admin_client.post(
        "/api/pitches", json={"title": f"Funding {pathway}", "funding_pathway": pathway}
    )
    assert create.status_code == 200
    assert create.json()["funding_pathway"] == pathway

    fetched = admin_client.get(f"/api/pitches/{create.json()['id']}")
    assert fetched.json()["funding_pathway"] == pathway


@pytest.mark.parametrize(
    "pathway", ["crc_bid", "rdti", "philanthropic", "government_grant", "private", "other"]
)
def test_funding_pathway_existing_value_still_accepted(admin_client, pathway):
    resp = admin_client.post(
        "/api/pitches", json={"title": f"Legacy {pathway}", "funding_pathway": pathway}
    )
    assert resp.status_code == 200
    assert resp.json()["funding_pathway"] == pathway


def test_funding_pathway_unknown_value_returns_422(admin_client):
    resp = admin_client.post(
        "/api/pitches", json={"title": "Bad", "funding_pathway": "not_a_pathway"}
    )
    assert resp.status_code == 422


# --- Domains ---


@pytest.mark.parametrize(
    "domain",
    [
        "AI",
        "Energy Transition",
        "Digital Finance",
        "Critical Minerals",
        "Semiconductors",
        "Health",
        "Innovation system",
        "Other",
    ],
)
def test_domain_tags_single_domain_round_trips(admin_client, domain):
    create = admin_client.post(
        "/api/pitches", json={"title": f"Domain {domain}", "domain_tags": domain}
    )
    assert create.status_code == 200
    assert create.json()["domain_tags"] == domain

    fetched = admin_client.get(f"/api/pitches/{create.json()['id']}")
    assert fetched.json()["domain_tags"] == domain


def test_domain_tags_multiple_domains_stored_comma_separated(admin_client):
    create = admin_client.post(
        "/api/pitches", json={"title": "Multi Domain", "domain_tags": "Health,Semiconductors"}
    )
    assert create.status_code == 200

    fetched = admin_client.get(f"/api/pitches/{create.json()['id']}")
    body = fetched.json()
    # Stored verbatim — the API neither reorders nor normalises the list.
    assert body["domain_tags"] == "Health,Semiconductors"
    assert body["domain_tags"].split(",") == ["Health", "Semiconductors"]


def test_domain_tags_defaults_to_null_when_omitted(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "No Domain"})
    assert create.status_code == 200
    assert create.json()["domain_tags"] is None


# --- Submission date ---


def test_submission_date_is_null_when_omitted(admin_client):
    """A pitch with no submission date recorded yet reads back as null, not a
    stand-in default."""
    create = admin_client.post("/api/pitches", json={"title": "Undated"})
    assert create.status_code == 200
    assert create.json()["submission_date"] is None

    fetched = admin_client.get(f"/api/pitches/{create.json()['id']}")
    assert fetched.json()["submission_date"] is None


def test_submission_date_accepts_explicit_null(admin_client):
    create = admin_client.post(
        "/api/pitches", json={"title": "Explicit Null", "submission_date": None}
    )
    assert create.status_code == 200
    assert create.json()["submission_date"] is None


@pytest.mark.parametrize("submitted_on", ["2024-01-01", "2026-12-31"])
def test_submission_date_round_trips_past_and_future(admin_client, submitted_on):
    create = admin_client.post(
        "/api/pitches", json={"title": f"Dated {submitted_on}", "submission_date": submitted_on}
    )
    assert create.status_code == 200
    assert create.json()["submission_date"] == submitted_on

    fetched = admin_client.get(f"/api/pitches/{create.json()['id']}")
    assert fetched.json()["submission_date"] == submitted_on


def test_submission_date_rejects_malformed_value(admin_client):
    resp = admin_client.post(
        "/api/pitches", json={"title": "Bad Date", "submission_date": "not-a-date"}
    )
    assert resp.status_code == 422


# --- Stage transitions ---


def test_stage_transition(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Stage Test Pitch"})
    pitch_id = create.json()["id"]

    resp = admin_client.post(
        f"/api/pitches/{pitch_id}/stage",
        json={"new_stage": "initial_screen", "note": "Passed initial review"},
    )
    assert resp.status_code == 200
    assert resp.json()["current_stage"] == "initial_screen"


def test_stage_history_recorded(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "History Test Pitch"})
    pitch_id = create.json()["id"]

    admin_client.post(
        f"/api/pitches/{pitch_id}/stage",
        json={"new_stage": "discovery_meeting"},
    )

    resp = admin_client.get(f"/api/pitches/{pitch_id}/history")
    assert resp.status_code == 200
    history = resp.json()
    # At least two entries: initial creation + the transition
    assert len(history) >= 2
    stages = [h["to_stage"] for h in history]
    assert "received" in stages
    assert "discovery_meeting" in stages


def test_stage_transition_on_nonexistent_pitch(admin_client):
    resp = admin_client.post(
        "/api/pitches/00000000-0000-0000-0000-000000000000/stage",
        json={"new_stage": "initial_screen"},
    )
    assert resp.status_code == 404


def test_stage_change_records_from_to_and_actor(admin_client):
    """A stage change appends a history row capturing from_stage, to_stage, the
    acting user (changed_by_id) and the note."""
    create = admin_client.post("/api/pitches", json={"title": "Attributed Stage"}).json()
    pid = create["id"]
    initial = admin_client.get(f"/api/pitches/{pid}/history").json()
    actor = initial[0]["changed_by_id"]
    assert actor is not None  # creation is attributed to the acting user

    resp = admin_client.post(
        f"/api/pitches/{pid}/stage",
        json={"new_stage": "initial_screen", "note": "passed screen"},
    )
    assert resp.status_code == 200

    history = admin_client.get(f"/api/pitches/{pid}/history").json()
    transition = [h for h in history if h["to_stage"] == "initial_screen"][0]
    assert transition["from_stage"] == "received"
    assert transition["changed_by_id"] == actor
    assert transition["note"] == "passed screen"


def test_assessor_can_change_stage(assessor_client):
    create = assessor_client.post("/api/pitches", json={"title": "Assessor Stage"}).json()
    pid = create["id"]
    resp = assessor_client.post(f"/api/pitches/{pid}/stage", json={"new_stage": "initial_screen"})
    assert resp.status_code == 200
    assert resp.json()["current_stage"] == "initial_screen"


def test_invalid_new_stage_returns_422(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Bad Stage"}).json()
    pid = create["id"]
    resp = admin_client.post(f"/api/pitches/{pid}/stage", json={"new_stage": "not_a_real_stage"})
    assert resp.status_code == 422


def test_unauthenticated_stage_change_is_rejected(client):
    # Missing credentials -> 403 from HTTPBearer; an invalid token -> 401. Either
    # way an unauthenticated stage change is refused.
    resp = client.post(
        "/api/pitches/00000000-0000-0000-0000-000000000099/stage",
        json={"new_stage": "initial_screen"},
    )
    assert resp.status_code in (401, 403)


# --- Filters ---


def test_filter_by_stage(admin_client):
    admin_client.post("/api/pitches", json={"title": "Declined Pitch"})
    pitches = admin_client.get("/api/pitches").json()
    declined_pitch = pitches[0]
    admin_client.post(
        f"/api/pitches/{declined_pitch['id']}/stage",
        json={"new_stage": "declined"},
    )

    resp = admin_client.get("/api/pitches?stage=declined")
    assert resp.status_code == 200
    stages = [p["current_stage"] for p in resp.json()]
    assert all(s == "declined" for s in stages)


# --- File links ---


def test_add_file_link(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "File Link Pitch"})
    pitch_id = create.json()["id"]

    resp = admin_client.post(
        f"/api/pitches/{pitch_id}/files",
        json={"file_path": "/docs/proposal.pdf", "label": "Proposal"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["file_path"] == "/docs/proposal.pdf"
    assert body["label"] == "Proposal"


def test_list_file_links(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "File List Pitch"})
    pitch_id = create.json()["id"]

    admin_client.post(
        f"/api/pitches/{pitch_id}/files",
        json={"file_path": "/docs/a.pdf", "label": "Doc A"},
    )
    admin_client.post(
        f"/api/pitches/{pitch_id}/files",
        json={"file_path": "/docs/b.pdf", "label": "Doc B"},
    )

    resp = admin_client.get(f"/api/pitches/{pitch_id}/files")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# --- Timeline ---


def test_timeline_returns_events(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Timeline Pitch"})
    pitch_id = create.json()["id"]

    resp = admin_client.get(f"/api/pitches/{pitch_id}/timeline")
    assert resp.status_code == 200
    body = resp.json()
    assert "events" in body
    assert "total" in body
    assert isinstance(body["events"], list)


# --- RBAC ---


def test_assessor_can_create_pitch(assessor_client):
    resp = assessor_client.post("/api/pitches", json={"title": "Assessor Pitch"})
    assert resp.status_code == 200


def test_viewer_cannot_create_pitch(viewer_client):
    resp = viewer_client.post("/api/pitches", json={"title": "Should Fail"})
    assert resp.status_code == 403


def test_viewer_can_list_pitches(viewer_client):
    resp = viewer_client.get("/api/pitches")
    assert resp.status_code == 200


def test_viewer_cannot_delete_pitch(viewer_client):
    # RBAC fires before DB lookup — fake UUID is sufficient to test the 403
    resp = viewer_client.delete("/api/pitches/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 403


def test_viewer_cannot_transition_stage(viewer_client):
    resp = viewer_client.post(
        "/api/pitches/00000000-0000-0000-0000-000000000099/stage",
        json={"new_stage": "initial_screen"},
    )
    assert resp.status_code == 403
