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
        PipelineStage,
        Pitch,
        PitchContact,
        PitchStageHistory,
    )
    from app.models.user import User, UserRole

    engine = create_engine(url)
    with Session(engine) as s:
        org = Organisation(name="Acme Research", org_type=OrgType.STARTUP)
        user = User(email="lead@example.com", display_name="Lead", role=UserRole.ASSESSOR)
        contact = Contact(first_name="Jane", last_name="External")
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

        s.add_all(
            [
                PitchStageHistory(
                    pitch_id=pitch.id,
                    to_stage=PipelineStage.INITIAL_SCREEN,
                    changed_by_id=user.id,
                ),
                PitchContact(pitch_id=pitch.id, contact_id=contact.id),
                Assessment(
                    national_impact=4,
                    translation_readiness=3,
                    team_capability=5,
                    ecosystem_fit=3,
                    funding_pathway_clarity=2,
                    masterplan_alignment=4,
                    recommendation=Recommendation.PROCEED,
                    assessment_date=dt.date(2026, 1, 1),
                    pitch_id=pitch.id,
                    assessor_id=user.id,
                ),
            ]
        )
        meeting = Meeting(
            title="Kickoff",
            meeting_date=dt.date(2026, 1, 2),
            platform=MeetingPlatform.TEAMS,
            pitch_id=pitch.id,
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


# --- Level 2 (per-revision): b7c3f1d29e84 splits contacts.name --------------

_GENESIS = "a1a27441d35c"
_SPLIT_CONTACT_NAME = "b7c3f1d29e84"

# (name before the split, expected first_name, expected last_name)
_SPLIT_CASES = [
    ("Jane Doe", "Jane", "Doe"),
    ("Prince", "Prince", None),
    ("Mary Jane van Doe", "Mary", "Jane van Doe"),
    ("  Padded  Name  ", "Padded", "Name"),
    ("", None, None),
]


def _contact_rows(url: str, columns: str) -> list[tuple]:
    from sqlalchemy import create_engine, text

    engine = create_engine(url)
    with engine.begin() as conn:
        rows = conn.execute(text(f"SELECT {columns} FROM contacts ORDER BY id")).all()
    engine.dispose()
    return [tuple(r) for r in rows]


def test_split_contact_name_preserves_existing_names(alembic, clean_db, pg_url):
    """Upgrading across b7c3f1d29e84 splits each stored name instead of dropping
    the column; downgrading recombines it."""
    from sqlalchemy import create_engine, text

    alembic("upgrade", _GENESIS)

    engine = create_engine(pg_url)
    with engine.begin() as conn:
        for i, (name, _, _) in enumerate(_SPLIT_CASES):
            conn.execute(
                text("INSERT INTO contacts (id, name) VALUES (:id, :name)"),
                {"id": f"00000000-0000-0000-0000-0000000000{i:02d}", "name": name},
            )
    engine.dispose()

    alembic("upgrade", _SPLIT_CONTACT_NAME)
    assert _contact_rows(pg_url, "first_name, last_name") == [
        (first, last) for _, first, last in _SPLIT_CASES
    ]

    alembic("downgrade", _GENESIS)
    assert _contact_rows(pg_url, "name") == [
        (" ".join(part for part in (first, last) if part),) for _, first, last in _SPLIT_CASES
    ]


# --- Level 2 (per-revision): single-column drops -----------------------------

_ROZETTA_NETWORK = "e6a4d81c37b2"

# (revision, table, column) in apply order. Each of these revisions drops exactly
# one column, which is what keeps `alembic downgrade -1` granular — one column
# comes back per step rather than a whole batch. Asserted below rather than left
# to the revisions' file names.
_COLUMN_DROPS = [
    ("f7b5c2e93a41", "pitch_contacts", "role_in_pitch"),
    ("0c9e4a17d5b2", "contacts", "last_contacted"),
    ("1d8f5b26e6c3", "contacts", "role"),
]


def _columns(url: str, table: str) -> set[str]:
    from sqlalchemy import create_engine, inspect

    engine = create_engine(url)
    names = {c["name"] for c in inspect(engine).get_columns(table)}
    engine.dispose()
    return names


def test_each_drop_is_a_separate_single_column_revision(alembic, clean_db, pg_url):
    """Stepping forward one revision drops one column; stepping back restores it."""
    alembic("upgrade", _ROZETTA_NETWORK)

    for revision, table, column in _COLUMN_DROPS:
        assert column in _columns(pg_url, table)
        alembic("upgrade", revision)
        assert column not in _columns(pg_url, table)

    for _revision, table, column in reversed(_COLUMN_DROPS):
        assert column not in _columns(pg_url, table)
        alembic("downgrade", "-1")
        assert column in _columns(pg_url, table)


def _seed_contact_with_dropped_columns(url: str) -> None:
    from sqlalchemy import create_engine, text

    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO contacts (id, first_name, role, last_contacted) "
                "VALUES (:id, :first, :role, :seen)"
            ),
            {
                "id": "00000000-0000-0000-0000-00000000ff01",
                "first": "Kept",
                "role": "CTO",
                "seen": dt.date(2026, 1, 1),
            },
        )
    engine.dispose()


def test_dropped_column_values_do_not_survive_a_downgrade(alembic, clean_db, pg_url):
    """The downgrades restore column *shape*, not contents — asserted so the
    lossiness stays a known property rather than a surprise mid-rollback.

    Recovering the values means restoring from backup/PITR, which is why each
    revision's docstring says so.
    """
    alembic("upgrade", _ROZETTA_NETWORK)
    _seed_contact_with_dropped_columns(pg_url)

    alembic("upgrade", "head")
    alembic("downgrade", _ROZETTA_NETWORK)

    # Untouched columns keep their values; the dropped ones come back empty.
    assert _contact_rows(pg_url, "first_name, role, last_contacted") == [("Kept", None, None)]


# --- Level 2 (per-revision): c8d1f0a45e29 moves the org link to a join table ---

_CONTACT_ROLE_DROPPED = "1d8f5b26e6c3"
_CONTACT_ORGANISATIONS = "c8d1f0a45e29"

_ZETA_ORG = "00000000-0000-0000-0000-00000000a001"
_ALPHA_ORG = "00000000-0000-0000-0000-00000000a002"
_LINKED_CONTACT = "00000000-0000-0000-0000-00000000b001"
_UNLINKED_CONTACT = "00000000-0000-0000-0000-00000000b002"


def _execute(url: str, statements: list[tuple[str, dict]]) -> None:
    from sqlalchemy import create_engine, text

    engine = create_engine(url)
    with engine.begin() as conn:
        for statement, params in statements:
            conn.execute(text(statement), params)
    engine.dispose()


def _rows(url: str, query: str) -> list[tuple]:
    from sqlalchemy import create_engine, text

    engine = create_engine(url)
    with engine.begin() as conn:
        result = conn.execute(text(query)).all()
    engine.dispose()
    return [tuple(r) for r in result]


def test_contact_organisations_backfills_the_existing_link(alembic, clean_db, pg_url):
    """Upgrading carries each contact's single organisation into a join row rather
    than dropping the column and losing the affiliation."""
    alembic("upgrade", _CONTACT_ROLE_DROPPED)
    _execute(
        pg_url,
        [
            ("INSERT INTO organisations (id, name) VALUES (:id, 'Zeta Org')", {"id": _ZETA_ORG}),
            ("INSERT INTO organisations (id, name) VALUES (:id, 'Alpha Org')", {"id": _ALPHA_ORG}),
            (
                "INSERT INTO contacts (id, first_name, organisation_id) "
                "VALUES (:id, 'Linked', :org)",
                {"id": _LINKED_CONTACT, "org": _ZETA_ORG},
            ),
            (
                "INSERT INTO contacts (id, first_name) VALUES (:id, 'Unlinked')",
                {"id": _UNLINKED_CONTACT},
            ),
        ],
    )

    alembic("upgrade", _CONTACT_ORGANISATIONS)

    assert _rows(
        pg_url,
        "SELECT contact_id::text, organisation_id::text FROM contact_organisations",
    ) == [(_LINKED_CONTACT, _ZETA_ORG)]
    assert "organisation_id" not in _columns(pg_url, "contacts")


def test_contact_organisations_downgrade_keeps_one_affiliation(alembic, clean_db, pg_url):
    """The downgrade is lossy by design — asserted so it stays a known property.

    A contact with several affiliations comes back with the one whose organisation
    name sorts first; the rest are gone and need a backup/PITR restore.
    """
    alembic("upgrade", _CONTACT_ROLE_DROPPED)
    _execute(
        pg_url,
        [
            ("INSERT INTO organisations (id, name) VALUES (:id, 'Zeta Org')", {"id": _ZETA_ORG}),
            ("INSERT INTO organisations (id, name) VALUES (:id, 'Alpha Org')", {"id": _ALPHA_ORG}),
            (
                "INSERT INTO contacts (id, first_name, organisation_id) "
                "VALUES (:id, 'Linked', :org)",
                {"id": _LINKED_CONTACT, "org": _ZETA_ORG},
            ),
            (
                "INSERT INTO contacts (id, first_name) VALUES (:id, 'Unlinked')",
                {"id": _UNLINKED_CONTACT},
            ),
        ],
    )
    alembic("upgrade", _CONTACT_ORGANISATIONS)

    # A second affiliation — the state the old column could never hold.
    _execute(
        pg_url,
        [
            (
                "INSERT INTO contact_organisations (id, contact_id, organisation_id) "
                "VALUES (gen_random_uuid(), :contact, :org)",
                {"contact": _LINKED_CONTACT, "org": _ALPHA_ORG},
            )
        ],
    )

    alembic("downgrade", _CONTACT_ROLE_DROPPED)

    assert _rows(pg_url, "SELECT first_name, organisation_id::text FROM contacts ORDER BY id") == [
        ("Linked", _ALPHA_ORG),
        ("Unlinked", None),
    ]
