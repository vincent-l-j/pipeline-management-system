"""Migration tests — forward, rollback, and model/migration parity.

Run against a disposable Postgres (see conftest.py). Mapped to the plan in
docs/best-practices/migrations.md:

  Level 1  test_round_trip_is_reversible   — upgrade → downgrade → upgrade
           test_single_head                — history stays linear
           test_migrations_match_models    — `alembic check` (empty autogen diff)
  Level 2  test_downgrade_runs_on_populated_db — downgrade doesn't choke on data

Per-migration data-*preservation* assertions (Level 2, full form) belong in
dedicated tests added alongside each data-migrating revision; a generic harness
can only prove downgrades execute cleanly against populated tables.
"""
import datetime as dt
import uuid

import pytest

pytestmark = pytest.mark.migrations


# --- Level 1: reversibility -------------------------------------------------

def test_round_trip_is_reversible(alembic, clean_db):
    """upgrade head → downgrade base → upgrade head, all clean.

    The second upgrade proves `downgrade base` left a slate the migrations can
    rebuild from — the core promise a rollback relies on.
    """
    alembic("upgrade", "head")
    alembic("downgrade", "base")
    alembic("upgrade", "head")


def test_single_head(alembic):
    """History must stay linear — exactly one head, or deploys are ambiguous."""
    result = alembic("heads")
    heads = [line for line in result.stdout.splitlines() if line.strip()]
    assert len(heads) == 1, f"expected a single head, got:\n{result.stdout}"


# --- Level 1 (cont.): model / migration parity ------------------------------

def test_migrations_match_models(alembic, clean_db):
    """`alembic check` finds no drift between the models and migrations at head.

    This is the hand-check gate for the baseline: if the migrations don't fully
    describe app/models (a missed column, wrong enum labels, a stray index),
    `alembic check` exits non-zero and reports the pending operations.
    """
    alembic("upgrade", "head")
    result = alembic("check", check=False)
    assert result.returncode == 0, (
        "models and migrations are out of sync — regenerate/fix the migration:\n"
        f"{result.stdout}\n{result.stderr}"
    )


# --- Level 2: downgrade tolerates real data ---------------------------------

def _seed_connected_graph(url: str) -> None:
    """Insert a small FK-connected graph so downgrades are exercised against
    populated, referentially-linked tables (a common source of downgrade bugs:
    wrong drop order, or DDL that assumes empty tables)."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.models.assessment import Assessment, Recommendation
    from app.models.contact import Contact
    from app.models.meeting import Meeting, MeetingAttendee, MeetingPlatform
    from app.models.organisation import Organisation, OrgType
    from app.models.pitch import (
        Pitch,
        PitchContact,
        PitchStageHistory,
        PipelineStage,
    )
    from app.models.user import User, UserRole

    engine = create_engine(url)
    with Session(engine) as s:
        org = Organisation(name="Acme Research", org_type=OrgType.STARTUP)
        user = User(email="lead@example.com", display_name="Lead", role=UserRole.ASSESSOR)
        contact = Contact(name="Jane External")
        s.add_all([org, user, contact])
        s.flush()

        pitch = Pitch(
            title="A pitch",
            current_stage=PipelineStage.RECEIVED,
            organisation_id=org.id,
            lead_id=user.id,
        )
        s.add(pitch)
        s.flush()

        s.add_all([
            PitchStageHistory(
                pitch_id=pitch.id,
                to_stage=PipelineStage.INITIAL_SCREEN,
                changed_by_id=user.id,
            ),
            PitchContact(pitch_id=pitch.id, contact_id=contact.id, role_in_pitch="founder"),
            Assessment(
                national_impact=4, translation_readiness=3, team_capability=5,
                ecosystem_fit=3, funding_pathway_clarity=2, masterplan_alignment=4,
                recommendation=Recommendation.PROCEED,
                assessment_date=dt.date(2026, 1, 1),
                pitch_id=pitch.id, assessor_id=user.id,
            ),
        ])
        meeting = Meeting(
            title="Kickoff", meeting_date=dt.date(2026, 1, 2),
            platform=MeetingPlatform.TEAMS, pitch_id=pitch.id,
        )
        s.add(meeting)
        s.flush()
        s.add(MeetingAttendee(meeting_id=meeting.id, user_id=user.id, is_internal=True))
        s.commit()
    engine.dispose()


def test_downgrade_runs_on_populated_db(alembic, clean_db, pg_url):
    """A full downgrade must not choke on populated, FK-linked tables."""
    alembic("upgrade", "head")
    _seed_connected_graph(pg_url)
    # The real assertion is that these don't raise (alembic runner asserts rc==0).
    alembic("downgrade", "base")
    alembic("upgrade", "head")
