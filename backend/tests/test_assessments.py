"""Tests for /api/assessments CRUD, auto-versioning, validation, and RBAC."""

import pytest

from tests.constants import UNKNOWN_ID


def _create_pitch(client):
    return client.post("/api/pitches", json={"title": "Assessment Target Pitch"}).json()["id"]


def _create_assessment(client):
    pitch_id = _create_pitch(client)
    assessment_id = client.post(
        "/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_id}
    ).json()["id"]
    return f"/api/assessments/{assessment_id}"


SCORE_PAYLOAD = {
    "national_impact": 4,
    "translation_readiness": 3,
    "team_capability": 5,
    "ecosystem_fit": 4,
    "funding_pathway_clarity": 3,
    "masterplan_alignment": 4,
    "recommendation": "proceed",
    "assessment_date": "2026-06-10",
}


# --- CRUD ---


def test_create_assessment(admin_client):
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["national_impact"] == 4
    assert body["recommendation"] == "proceed"
    assert body["version"] == 1
    assert body["pitch_id"] == pitch_id


def test_list_assessments(admin_client):
    resp = admin_client.get("/api/assessments")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_assessment(admin_client):
    pitch_id = _create_pitch(admin_client)
    create = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    )
    assessment_id = create.json()["id"]

    resp = admin_client.get(f"/api/assessments/{assessment_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == assessment_id


def test_get_nonexistent_assessment(admin_client):
    resp = admin_client.get(f"/api/assessments/{UNKNOWN_ID}")
    assert resp.status_code == 404


# --- Auto-versioning ---


def test_assessment_auto_versioning(admin_client):
    pitch_id = _create_pitch(admin_client)

    first = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()
    second = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()
    third = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()

    assert first["version"] == 1
    assert second["version"] == 2
    assert third["version"] == 3


def test_versions_are_independent_per_pitch(admin_client):
    pitch_a = _create_pitch(admin_client)
    pitch_b = _create_pitch(admin_client)

    a1 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_a}).json()
    b1 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_b}).json()
    a2 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_a}).json()

    assert a1["version"] == 1
    assert b1["version"] == 1
    assert a2["version"] == 2


# --- Score validation ---


@pytest.mark.parametrize(
    "field",
    [
        "national_impact",
        "translation_readiness",
        "team_capability",
        "ecosystem_fit",
        "funding_pathway_clarity",
        "masterplan_alignment",
    ],
)
def test_score_above_5_rejected(admin_client, field):
    pitch_id = _create_pitch(admin_client)
    payload = {**SCORE_PAYLOAD, "pitch_id": pitch_id, field: 6}
    resp = admin_client.post("/api/assessments", json=payload)
    assert resp.status_code == 422


@pytest.mark.parametrize(
    "field",
    [
        "national_impact",
        "translation_readiness",
        "team_capability",
        "ecosystem_fit",
        "funding_pathway_clarity",
        "masterplan_alignment",
    ],
)
def test_score_below_1_rejected(admin_client, field):
    pitch_id = _create_pitch(admin_client)
    payload = {**SCORE_PAYLOAD, "pitch_id": pitch_id, field: 0}
    resp = admin_client.post("/api/assessments", json=payload)
    assert resp.status_code == 422


# --- Filter by pitch_id ---


def test_get_pitch_assessments_returns_all_versions(admin_client):
    """GET /pitches/{id}/assessments returns ALL versions for that pitch."""
    pitch_id = _create_pitch(admin_client)
    v1 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_id}).json()
    v2 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_id}).json()
    v3 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_id}).json()

    resp = admin_client.get(f"/api/pitches/{pitch_id}/assessments")
    assert resp.status_code == 200
    results = resp.json()
    # Should return all 3 versions
    assert len(results) == 3
    assert all(a["pitch_id"] == pitch_id for a in results)
    # Verify we got all three versions
    result_ids = {a["id"] for a in results}
    assert result_ids == {v1["id"], v2["id"], v3["id"]}


# --- RBAC ---


def test_viewer_cannot_create_assessment(viewer_client):
    fake_pitch_id = UNKNOWN_ID
    resp = viewer_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": fake_pitch_id})
    assert resp.status_code == 403


def test_viewer_can_list_assessments(viewer_client):
    resp = viewer_client.get("/api/assessments")
    assert resp.status_code == 200


def test_assessor_can_create_assessment(assessor_client):
    pitch_id = _create_pitch(assessor_client)
    resp = assessor_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_id})
    assert resp.status_code == 200


def test_create_assessment_without_credentials_is_rejected(client):
    """Unauthenticated request (no credentials) returns 403."""
    resp = client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": UNKNOWN_ID},
    )
    assert resp.status_code == 403


def test_create_assessment_with_invalid_token_is_rejected(client):
    """Request with invalid bearer token returns 401."""
    resp = client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": UNKNOWN_ID},
        headers={"Authorization": "Bearer invalid_token"},
    )
    assert resp.status_code == 401


# --- Latest-version-only list ---


def test_list_shows_only_latest_version_per_pitch(admin_client):
    pitch_id = _create_pitch(admin_client)

    # Create three versions of the same assessment
    admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()
    admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()
    v3 = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()

    # List all assessments
    resp = admin_client.get("/api/assessments")
    assert resp.status_code == 200
    results = resp.json()

    # Filter to this pitch's assessments
    pitch_assessments = [a for a in results if a["pitch_id"] == pitch_id]

    # Should have exactly one: the latest version
    assert len(pitch_assessments) == 1
    assert pitch_assessments[0]["version"] == 3
    assert pitch_assessments[0]["id"] == v3["id"]


def test_list_shows_only_latest_version_per_pitch_multiple_pitches(admin_client):
    pitch_a = _create_pitch(admin_client)
    pitch_b = _create_pitch(admin_client)

    # Create versions for pitch A
    admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_a})
    admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_a})
    a2_v3 = admin_client.post(
        "/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_a}
    ).json()

    # Create versions for pitch B
    admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_b})
    b_v2 = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_b}).json()

    # List all assessments
    resp = admin_client.get("/api/assessments")
    assert resp.status_code == 200
    results = resp.json()

    # Find assessments for our pitches
    a_assessments = [a for a in results if a["pitch_id"] == pitch_a]
    b_assessments = [a for a in results if a["pitch_id"] == pitch_b]

    # Should have exactly one of each pitch
    assert len(a_assessments) == 1
    assert a_assessments[0]["version"] == 3
    assert a_assessments[0]["id"] == a2_v3["id"]

    assert len(b_assessments) == 1
    assert b_assessments[0]["version"] == 2
    assert b_assessments[0]["id"] == b_v2["id"]


# --- Amending (pitch cannot change) ---


def test_amending_creates_new_version_without_mutating_prior(admin_client):
    """A second create appends a new version; the prior row keeps its own scores
    and recommendation on a subsequent GET."""
    pitch_id = _create_pitch(admin_client)

    v1 = admin_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "pitch_id": pitch_id,
            "national_impact": 4,
            "recommendation": "proceed",
        },
    ).json()
    v2 = admin_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "pitch_id": pitch_id,
            "national_impact": 2,
            "recommendation": "decline",
        },
    ).json()

    assert v2["version"] == v1["version"] + 1
    assert v1["id"] != v2["id"]

    # The original version is untouched.
    prior = admin_client.get(f"/api/assessments/{v1['id']}").json()
    assert prior["national_impact"] == 4
    assert prior["recommendation"] == "proceed"
    assert prior["version"] == 1


def test_new_version_records_supplied_date_and_acting_assessor(admin_client, assessor_client):
    """Each version carries its own date and is attributed to the acting user,
    independently of who authored the prior version."""
    pitch_id = _create_pitch(admin_client)

    v1 = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id, "assessment_date": "2026-06-10"},
    ).json()
    v2 = assessor_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id, "assessment_date": "2026-07-01"},
    ).json()

    # Date is taken from the request, per version.
    assert v1["assessment_date"] == "2026-06-10"
    assert v2["assessment_date"] == "2026-07-01"
    # Attribution follows the acting user, not the prior author.
    assert v2["assessor_id"] != v1["assessor_id"]


def test_assessment_patch_not_allowed(admin_client):
    """PATCH on an assessment is not routed (405)."""
    url = _create_assessment(admin_client)
    resp = admin_client.patch(url, json={"national_impact": 1})
    assert resp.status_code == 405
    assert admin_client.get(url).status_code == 200


def test_assessment_put_not_allowed(admin_client):
    """PUT on an assessment is not routed (405)."""
    url = _create_assessment(admin_client)
    resp = admin_client.put(url, json={"national_impact": 1})
    assert resp.status_code == 405
    assert admin_client.get(url).status_code == 200


def test_assessment_delete_not_allowed(admin_client):
    """DELETE on an assessment is not routed (405)."""
    url = _create_assessment(admin_client)
    resp = admin_client.delete(url)
    assert resp.status_code == 405
    assert admin_client.get(url).status_code == 200


def test_amend_assessment_with_valid_from_id(admin_client):
    """When amending, amending_from_id query param is accepted."""
    pitch_id = _create_pitch(admin_client)
    v1 = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    ).json()

    # Amend with the amending_from_id parameter
    resp = admin_client.post(
        f"/api/assessments?amending_from_id={v1['id']}",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    )
    assert resp.status_code == 200
    v2 = resp.json()
    assert v2["version"] == 2
    assert v2["pitch_id"] == pitch_id


def test_amend_with_different_pitch_rejected(admin_client):
    """Cannot amend an assessment and reassign it to a different pitch."""
    pitch_a = _create_pitch(admin_client)
    pitch_b = _create_pitch(admin_client)

    v1 = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_a},
    ).json()

    # Try to amend but change the pitch_id
    resp = admin_client.post(
        f"/api/assessments?amending_from_id={v1['id']}",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_b},
    )
    assert resp.status_code == 422
    assert "cannot change pitch" in resp.json()["detail"].lower()

    # Verify no new version was created
    list_resp = admin_client.get(f"/api/pitches/{pitch_b}/assessments")
    assert len(list_resp.json()) == 0


def test_amend_with_nonexistent_from_id_rejected(admin_client):
    """Cannot amend from a non-existent assessment."""
    pitch_id = _create_pitch(admin_client)
    fake_id = UNKNOWN_ID

    resp = admin_client.post(
        f"/api/assessments?amending_from_id={fake_id}",
        json={**SCORE_PAYLOAD, "pitch_id": pitch_id},
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


# --- Decline reasons ---


# The reason vocabulary as it goes over the wire. Mirrored by
# DECLINE_REASON_LABELS in frontend/src/components/assessments/AssessmentConfig.ts.
EXPECTED_DECLINE_REASONS = [
    "not_strategic_priority",
    "insufficient_scale",
    "insufficient_capacity_capability",
    "grant_funding_rejected",
    "lack_of_rozetta_capacity",
    "other",
]


def test_decline_reason_vocabulary_matches_the_enum():
    """Adding or removing a DeclineReason member without updating this list — and
    the frontend labels and the Alembic enum that mirror it — fails here."""
    from app.models.assessment import DeclineReason

    assert [r.value for r in DeclineReason] == EXPECTED_DECLINE_REASONS


@pytest.mark.parametrize("reason", EXPECTED_DECLINE_REASONS)
def test_decline_reason_round_trips(admin_client, reason):
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "recommendation": "decline",
            "decline_reason": reason,
            "pitch_id": pitch_id,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["decline_reason"] == reason

    fetched = admin_client.get(f"/api/assessments/{resp.json()['id']}")
    assert fetched.json()["decline_reason"] == reason


def test_decline_without_a_reason_is_accepted(admin_client):
    """The reason is optional, so declining without one must stay valid."""
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post(
        "/api/assessments",
        json={**SCORE_PAYLOAD, "recommendation": "decline", "pitch_id": pitch_id},
    )
    assert resp.status_code == 200
    assert resp.json()["decline_reason"] is None


def test_non_decline_assessment_has_no_reason(admin_client):
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post("/api/assessments", json={**SCORE_PAYLOAD, "pitch_id": pitch_id})
    assert resp.status_code == 200
    assert resp.json()["decline_reason"] is None


@pytest.mark.parametrize("recommendation", ["proceed", "park"])
def test_reason_supplied_without_a_decline_is_rejected(admin_client, recommendation):
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "recommendation": recommendation,
            "decline_reason": "insufficient_scale",
            "pitch_id": pitch_id,
        },
    )
    assert resp.status_code == 422

    # Nothing was stored.
    assert admin_client.get(f"/api/pitches/{pitch_id}/assessments").json() == []


def test_unknown_decline_reason_is_rejected(admin_client):
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "recommendation": "decline",
            "decline_reason": "we_just_did_not_fancy_it",
            "pitch_id": pitch_id,
        },
    )
    assert resp.status_code == 422


def test_empty_string_decline_reason_is_rejected(admin_client):
    """The frontend must send null, not "", when no reason is chosen."""
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "recommendation": "decline",
            "decline_reason": "",
            "pitch_id": pitch_id,
        },
    )
    assert resp.status_code == 422


def test_explicit_null_decline_reason_is_accepted(admin_client):
    pitch_id = _create_pitch(admin_client)
    resp = admin_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "recommendation": "decline",
            "decline_reason": None,
            "pitch_id": pitch_id,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["decline_reason"] is None


def test_amending_a_decline_keeps_each_version_reason(admin_client):
    """Assessments are immutable-with-versions, so the history of *why* survives."""
    pitch_id = _create_pitch(admin_client)
    first = admin_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "recommendation": "decline",
            "decline_reason": "insufficient_scale",
            "pitch_id": pitch_id,
        },
    ).json()

    second = admin_client.post(
        f"/api/assessments?amending_from_id={first['id']}",
        json={
            **SCORE_PAYLOAD,
            "recommendation": "decline",
            "decline_reason": "grant_funding_rejected",
            "pitch_id": pitch_id,
        },
    ).json()

    assert second["version"] == first["version"] + 1
    assert second["decline_reason"] == "grant_funding_rejected"
    # The earlier version keeps its original reason.
    assert (
        admin_client.get(f"/api/assessments/{first['id']}").json()["decline_reason"]
        == "insufficient_scale"
    )


def test_assessor_can_record_a_decline_reason(assessor_client):
    pitch_id = _create_pitch(assessor_client)
    resp = assessor_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "recommendation": "decline",
            "decline_reason": "other",
            "pitch_id": pitch_id,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["decline_reason"] == "other"


def test_viewer_cannot_record_a_decline_reason(viewer_client, admin_client):
    pitch_id = _create_pitch(admin_client)
    resp = viewer_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "recommendation": "decline",
            "decline_reason": "other",
            "pitch_id": pitch_id,
        },
    )
    assert resp.status_code == 403


def test_viewer_can_read_a_decline_reason(admin_client, viewer_client):
    pitch_id = _create_pitch(admin_client)
    created = admin_client.post(
        "/api/assessments",
        json={
            **SCORE_PAYLOAD,
            "recommendation": "decline",
            "decline_reason": "not_strategic_priority",
            "pitch_id": pitch_id,
        },
    ).json()

    resp = viewer_client.get(f"/api/assessments/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["decline_reason"] == "not_strategic_priority"
