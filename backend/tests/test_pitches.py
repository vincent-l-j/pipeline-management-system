"""Tests for /api/pitches CRUD, stage transitions, file links, and RBAC."""

from uuid import UUID

import pytest

from app.models.pitch import PitchSource
from tests.constants import UNKNOWN_ID

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
        f"/api/pitches/{UNKNOWN_ID}",
        json={"title": "Nope"},
    )
    assert resp.status_code == 403


def test_patch_unknown_pitch_returns_404(admin_client):
    resp = admin_client.patch(
        f"/api/pitches/{UNKNOWN_ID}",
        json={"title": "X"},
    )
    assert resp.status_code == 404


def test_unauthenticated_patch_is_rejected(client):
    resp = client.patch(
        f"/api/pitches/{UNKNOWN_ID}",
        json={"title": "X"},
    )
    assert resp.status_code == 403


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


def test_delete_unknown_pitch_returns_404(admin_client):
    resp = admin_client.delete(f"/api/pitches/{UNKNOWN_ID}")
    assert resp.status_code == 404


def test_unauthenticated_delete_is_rejected(client):
    resp = client.delete(f"/api/pitches/{UNKNOWN_ID}")
    assert resp.status_code == 403


def test_delete_pitch_removes_dependent_rows(admin_client, db_session):
    """Deleting a pitch removes everything it owns in the same transaction:
    stage history, contact links, file links, assessments, meetings, and the
    attendee rows hanging off those meetings."""
    from app.models.assessment import Assessment
    from app.models.meeting import Meeting, MeetingAttendee
    from app.models.pitch import PitchContact, PitchFileLink, PitchStageHistory

    pitch_id = admin_client.post("/api/pitches", json={"title": "Fully Linked Pitch"}).json()["id"]
    contact_id = admin_client.post(
        "/api/contacts", json={"first_name": "Linked", "last_name": "Person"}
    ).json()["id"]

    # A meeting with both an external and an internal attendee.
    meeting_id = admin_client.post(
        "/api/meetings",
        json={"title": "Kickoff", "meeting_date": "2026-01-01", "pitch_id": pitch_id},
    ).json()["id"]
    assert (
        admin_client.post(
            f"/api/meetings/{meeting_id}/attendees",
            json={"contact_id": contact_id, "is_internal": False},
        ).status_code
        == 200
    )

    admin_client.post(
        "/api/assessments",
        json={
            "pitch_id": pitch_id,
            "national_impact": 4,
            "translation_readiness": 3,
            "team_capability": 5,
            "ecosystem_fit": 4,
            "funding_pathway_clarity": 3,
            "masterplan_alignment": 4,
            "recommendation": "proceed",
            "assessment_date": "2026-06-10",
        },
    )
    admin_client.post(
        f"/api/pitches/{pitch_id}/files",
        json={"file_path": "/docs/deck.pdf", "label": "Deck"},
    )
    admin_client.post(f"/api/pitches/{pitch_id}/stage", json={"new_stage": "initial_screen"})

    # PitchContact has no create endpoint — insert the join row directly.
    db_session.add(PitchContact(pitch_id=UUID(pitch_id), contact_id=UUID(contact_id)))
    db_session.commit()

    resp = admin_client.delete(f"/api/pitches/{pitch_id}")
    assert resp.status_code == 200
    assert admin_client.get(f"/api/pitches/{pitch_id}").status_code == 404

    db_session.expire_all()
    pid = UUID(pitch_id)
    assert db_session.query(PitchStageHistory).filter_by(pitch_id=pid).count() == 0
    assert db_session.query(PitchContact).filter_by(pitch_id=pid).count() == 0
    assert db_session.query(PitchFileLink).filter_by(pitch_id=pid).count() == 0
    assert db_session.query(Assessment).filter_by(pitch_id=pid).count() == 0
    assert db_session.query(Meeting).filter_by(pitch_id=pid).count() == 0
    assert db_session.query(MeetingAttendee).filter_by(meeting_id=UUID(meeting_id)).count() == 0


def test_delete_pitch_keeps_contacts_and_organisations(admin_client, db_session):
    """The people and organisations a pitch pointed at outlive it."""
    from app.models.pitch import PitchContact

    org_id = admin_client.post("/api/organisations", json={"name": "Surviving Org"}).json()["id"]
    contact_id = admin_client.post(
        "/api/contacts", json={"first_name": "Surviving", "last_name": "Contact"}
    ).json()["id"]
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Doomed Pitch", "organisation_id": org_id}
    ).json()["id"]

    db_session.add(PitchContact(pitch_id=UUID(pitch_id), contact_id=UUID(contact_id)))
    db_session.commit()

    assert admin_client.delete(f"/api/pitches/{pitch_id}").status_code == 200

    assert admin_client.get(f"/api/organisations/{org_id}").status_code == 200
    assert admin_client.get(f"/api/contacts/{contact_id}").status_code == 200


def test_get_nonexistent_pitch(admin_client):
    resp = admin_client.get(f"/api/pitches/{UNKNOWN_ID}")
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


def test_patch_updates_submission_date(admin_client):
    create = admin_client.post(
        "/api/pitches", json={"title": "Redated", "submission_date": "2024-01-01"}
    )
    pitch_id = create.json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"submission_date": "2026-03-09"})
    assert resp.status_code == 200
    assert resp.json()["submission_date"] == "2026-03-09"

    fetched = admin_client.get(f"/api/pitches/{pitch_id}")
    assert fetched.json()["submission_date"] == "2026-03-09"


def test_patch_can_clear_submission_date(admin_client):
    create = admin_client.post(
        "/api/pitches", json={"title": "Cleared", "submission_date": "2024-01-01"}
    )
    pitch_id = create.json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"submission_date": None})
    assert resp.status_code == 200
    assert resp.json()["submission_date"] is None


def test_patch_leaves_submission_date_untouched_when_omitted(admin_client):
    """exclude_unset means an unrelated edit must not wipe the date."""
    create = admin_client.post(
        "/api/pitches", json={"title": "Kept", "submission_date": "2024-01-01"}
    )
    pitch_id = create.json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"title": "Kept v2"})
    assert resp.status_code == 200
    assert resp.json()["submission_date"] == "2024-01-01"


def test_patch_rejects_malformed_submission_date(admin_client):
    create = admin_client.post("/api/pitches", json={"title": "Bad Patch Date"})
    resp = admin_client.patch(
        f"/api/pitches/{create.json()['id']}", json={"submission_date": "not-a-date"}
    )
    assert resp.status_code == 422


# --- Contacts on a pitch ---


def _contact(client, first_name):
    return client.post("/api/contacts", json={"first_name": first_name}).json()["id"]


def test_create_pitch_with_contacts(admin_client):
    ada = _contact(admin_client, "Ada")
    grace = _contact(admin_client, "Grace")

    resp = admin_client.post(
        "/api/pitches", json={"title": "Two People", "contact_ids": [ada, grace]}
    )
    assert resp.status_code == 200
    assert sorted(resp.json()["contact_ids"]) == sorted([ada, grace])


def test_pitch_contacts_default_to_none_at_all(admin_client):
    resp = admin_client.post("/api/pitches", json={"title": "Nobody Yet"})
    assert resp.status_code == 200
    assert resp.json()["contact_ids"] == []


def test_get_pitch_reports_its_contacts(admin_client):
    ada = _contact(admin_client, "Ada")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Fetch Me", "contact_ids": [ada]}
    ).json()["id"]

    resp = admin_client.get(f"/api/pitches/{pitch_id}")
    assert resp.status_code == 200
    assert resp.json()["contact_ids"] == [ada]


def test_list_pitches_reports_contacts(admin_client):
    ada = _contact(admin_client, "Ada")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Listed With Ada", "contact_ids": [ada]}
    ).json()["id"]

    listed = {p["id"]: p for p in admin_client.get("/api/pitches").json()}
    assert listed[pitch_id]["contact_ids"] == [ada]


def test_patch_replaces_the_whole_set(admin_client):
    """Links are unordered and equal, with no per-link identity to patch, so a
    supplied list replaces the lot."""
    ada = _contact(admin_client, "Ada")
    grace = _contact(admin_client, "Grace")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Swap People", "contact_ids": [ada]}
    ).json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"contact_ids": [grace]})
    assert resp.status_code == 200
    assert resp.json()["contact_ids"] == [grace]


def test_patch_can_clear_the_contacts(admin_client):
    ada = _contact(admin_client, "Ada")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Clear People", "contact_ids": [ada]}
    ).json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"contact_ids": []})
    assert resp.status_code == 200
    assert resp.json()["contact_ids"] == []


def test_patch_leaves_contacts_alone_when_omitted(admin_client):
    ada = _contact(admin_client, "Ada")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Keep People", "contact_ids": [ada]}
    ).json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"title": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["contact_ids"] == [ada]


def test_duplicate_contact_ids_collapse_to_one_link(admin_client, db_session):
    from app.models.pitch import PitchContact

    ada = _contact(admin_client, "Ada")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Said Twice", "contact_ids": [ada, ada]}
    ).json()["id"]

    assert admin_client.get(f"/api/pitches/{pitch_id}").json()["contact_ids"] == [ada]
    assert db_session.query(PitchContact).filter_by(pitch_id=UUID(pitch_id)).count() == 1


def test_the_same_pair_cannot_be_stored_twice(admin_client, db_session):
    """The uniqueness of a link is the database's rule, not just the route's.

    The app-code collapse above only holds while every write replaces the whole
    set. A per-link attach endpoint, or any second writer, would otherwise be
    free to insert the same pair again — and two rows for one pair means a
    doubled name and count everywhere `contact_ids` is read.
    """
    from sqlalchemy.exc import IntegrityError

    from app.models.pitch import PitchContact

    ada = _contact(admin_client, "Ada")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Once Only", "contact_ids": [ada]}
    ).json()["id"]

    db_session.add(PitchContact(pitch_id=UUID(pitch_id), contact_id=UUID(ada)))
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_patch_keeping_a_contact_while_adding_another(admin_client):
    """The overlapping case: Ada stays, Grace joins.

    Worth its own test because it is the one that meets the uniqueness rule
    head-on. Replacing the set means the kept link is written again, so a naive
    replace inserts a second (pitch, Ada) row before deleting the first and
    trips the constraint on a request that asked for nothing unusual.
    """
    ada = _contact(admin_client, "Ada")
    grace = _contact(admin_client, "Grace")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Ada Stays", "contact_ids": [ada]}
    ).json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"contact_ids": [ada, grace]})
    assert resp.status_code == 200
    assert sorted(resp.json()["contact_ids"]) == sorted([ada, grace])


def test_patch_keeping_one_contact_and_dropping_another(admin_client, db_session):
    """The mirror of the above: Ada stays, Grace goes, and no row is left over."""
    from app.models.pitch import PitchContact

    ada = _contact(admin_client, "Ada")
    grace = _contact(admin_client, "Grace")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Grace Goes", "contact_ids": [ada, grace]}
    ).json()["id"]

    resp = admin_client.patch(f"/api/pitches/{pitch_id}", json={"contact_ids": [ada]})
    assert resp.status_code == 200
    assert resp.json()["contact_ids"] == [ada]
    assert db_session.query(PitchContact).filter_by(pitch_id=UUID(pitch_id)).count() == 1


def test_create_with_unknown_contact_is_rejected(admin_client):
    resp = admin_client.post(
        "/api/pitches", json={"title": "Ghost Contact", "contact_ids": [UNKNOWN_ID]}
    )
    assert resp.status_code == 422
    assert UNKNOWN_ID in resp.json()["detail"]


def test_create_with_unknown_contact_creates_no_pitch(admin_client):
    before = len(admin_client.get("/api/pitches").json())

    admin_client.post("/api/pitches", json={"title": "Never Saved", "contact_ids": [UNKNOWN_ID]})

    listed = admin_client.get("/api/pitches").json()
    assert len(listed) == before
    assert all(pitch["title"] != "Never Saved" for pitch in listed)


def test_patch_with_unknown_contact_changes_nothing(admin_client):
    ada = _contact(admin_client, "Ada")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Unchanged", "contact_ids": [ada]}
    ).json()["id"]

    resp = admin_client.patch(
        f"/api/pitches/{pitch_id}",
        json={"title": "Renamed", "contact_ids": [UNKNOWN_ID]},
    )
    assert resp.status_code == 422

    # The rejected request left both the links and the other fields as they were.
    body = admin_client.get(f"/api/pitches/{pitch_id}").json()
    assert body["contact_ids"] == [ada]
    assert body["title"] == "Unchanged"


def test_deleting_a_contact_drops_it_from_the_pitch(admin_client):
    ada = _contact(admin_client, "Ada")
    grace = _contact(admin_client, "Grace")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Losing Ada", "contact_ids": [ada, grace]}
    ).json()["id"]

    assert admin_client.delete(f"/api/contacts/{ada}").status_code == 200

    assert admin_client.get(f"/api/pitches/{pitch_id}").json()["contact_ids"] == [grace]


def test_linking_a_contact_leaves_the_contact_itself_alone(admin_client):
    """A pitch link is not an affiliation: the contact's organisations are its own."""
    org_id = admin_client.post("/api/organisations", json={"name": "Acme"}).json()["id"]
    contact_id = admin_client.post(
        "/api/contacts", json={"first_name": "Ada", "organisation_ids": [org_id]}
    ).json()["id"]

    admin_client.post("/api/pitches", json={"title": "Linked", "contact_ids": [contact_id]})

    assert admin_client.get(f"/api/contacts/{contact_id}").json()["organisation_ids"] == [org_id]


def test_assessor_can_link_contacts(assessor_client):
    ada = _contact(assessor_client, "Ada")

    resp = assessor_client.post(
        "/api/pitches", json={"title": "Assessor Linked", "contact_ids": [ada]}
    )
    assert resp.status_code == 200
    assert resp.json()["contact_ids"] == [ada]


def test_viewer_cannot_link_contacts(viewer_client):
    resp = viewer_client.patch(
        f"/api/pitches/{UNKNOWN_ID}",
        json={"contact_ids": [UNKNOWN_ID]},
    )
    assert resp.status_code == 403


def test_viewer_can_read_the_contacts_on_a_pitch(admin_client, viewer_client):
    ada = _contact(admin_client, "Ada")
    pitch_id = admin_client.post(
        "/api/pitches", json={"title": "Readable", "contact_ids": [ada]}
    ).json()["id"]

    resp = viewer_client.get(f"/api/pitches/{pitch_id}")
    assert resp.status_code == 200
    assert resp.json()["contact_ids"] == [ada]


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
        f"/api/pitches/{UNKNOWN_ID}/stage",
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
    resp = client.post(
        f"/api/pitches/{UNKNOWN_ID}/stage",
        json={"new_stage": "initial_screen"},
    )
    assert resp.status_code == 403


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
    resp = viewer_client.delete(f"/api/pitches/{UNKNOWN_ID}")
    assert resp.status_code == 403


def test_assessor_cannot_delete_pitch(assessor_client):
    """Delete is admin-only: an assessor may create and edit, but not remove."""
    resp = assessor_client.delete(f"/api/pitches/{UNKNOWN_ID}")
    assert resp.status_code == 403


def test_viewer_cannot_transition_stage(viewer_client):
    resp = viewer_client.post(
        f"/api/pitches/{UNKNOWN_ID}/stage",
        json={"new_stage": "initial_screen"},
    )
    assert resp.status_code == 403
