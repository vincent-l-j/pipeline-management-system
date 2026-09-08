"""Shared test fixtures.

Tests run against a real PostgreSQL database, whose schema is built by the same
Alembic migrations the deploy job runs. SQLite was faster and needed nothing
running, but it is not the database this app ships on and it cannot fail the way
Postgres does: it has no native enum types, ignores `VARCHAR` lengths, drops the
timezone off a `TIMESTAMP WITH TIME ZONE`, does not enforce foreign keys, and
compiles `ILIKE` to an ASCII-only `lower() LIKE lower()`. Every one of those is a
production behaviour a green test run used to assert nothing about.

`APP_TEST_DATABASE_URL` selects the database; it defaults to the compose `db`
service. It MUST NOT be the same database as the migration suite's
`TEST_DATABASE_URL` — that suite runs `DROP SCHEMA public CASCADE` between tests
and would pull this schema out from under a concurrent run. Both are disposable:
this one is dropped and rebuilt at the start of every session.

Isolation is per test, by `TRUNCATE` rather than by rolling back a wrapping
transaction. Rollback would have been cheaper, but it makes the whole of a test
one transaction — so `server_default=func.now()` stamps every row a test creates
with the same instant, and application `commit()` calls stop being commits. The
point of moving off SQLite was to stop the test database behaving unlike the real
one; buying speed back with a second such difference would undo it.
"""

import os

# Must be set before app.core.config / app.core.database are imported, so the
# app's own module-level engine points at the test database too. Written into the
# environment rather than into a module variable, which is the only shape allowed
# ahead of the imports below; it is read back once they are done.
os.environ["DATABASE_URL"] = os.environ.get(
    "APP_TEST_DATABASE_URL",
    "postgresql://rozetta:change_me_to_a_strong_password@db:5432/pms_app_test",
)
os.environ["ENABLE_DEV_LOGIN"] = "false"
# config.py has no defaults for these secrets (a missing secret must crash prod,
# not run on a guessable key); give the test app throwaway values to boot with.
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("AZURE_CLIENT_SECRET", "test-azure-client-secret")
# The JSON handler writes to stdout, so at INFO every request would print under
# `pytest -s`. Tests that assert on records raise the level themselves with
# `caplog.set_level(..., logger=...)`.
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["ENVIRONMENT"] = "test"

import io
import json
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

import psycopg2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.documents import get_document_store
from app.core.logging import setup_logging
from app.core.security import get_current_user
from app.main import app
from app.models import Base
from app.models.user import User, UserRole
from tests.fake_document_store import FakeDocumentStore

# backend/ — the directory containing alembic.ini.
BACKEND_DIR = Path(__file__).resolve().parents[1]

# The URL the preamble settled on, whether from the environment or the default.
_TEST_DATABASE_URL = os.environ["DATABASE_URL"]

_NOW = datetime(2026, 1, 1, tzinfo=UTC)

# Fixed UUIDs, so a test can name the acting user without first reading it back.
_ADMIN_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
_ASSESSOR_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000002")
_VIEWER_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000003")

# One spec per acting role, used both to seed the row and to build the object the
# auth dependency returns. They have to agree: `users.id` is a real foreign key
# target now, so a `current_user` with no row behind it fails every route that
# stamps an actor (`assessor_id`, `uploaded_by_id`, `changed_by_id`).
_FIXTURE_USERS = {
    UserRole.ADMIN: {"id": _ADMIN_ID, "email": "tester@rozettainstitute.com", "name": "Tester"},
    UserRole.ASSESSOR: {
        "id": _ASSESSOR_ID,
        "email": "assessor@rozettainstitute.com",
        "name": "Assessor",
    },
    UserRole.VIEWER: {"id": _VIEWER_ID, "email": "viewer@rozettainstitute.com", "name": "Viewer"},
}

# Lazy: constructing an Engine opens nothing, so importing this module — which
# `--collect-only` does — still needs no database.
_engine = create_engine(_TEST_DATABASE_URL)
_TestSession = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


def _fixture_user(role: UserRole) -> User:
    spec = _FIXTURE_USERS[role]
    return User(
        id=spec["id"],
        email=spec["email"],
        display_name=spec["name"],
        role=role,
        is_active=True,
        created_at=_NOW,
        updated_at=_NOW,
    )


def _get_test_db():
    db = _TestSession()
    try:
        yield db
    finally:
        db.close()


def _create_database_if_absent() -> None:
    """Create the test database, so no environment needs a manual prep step.

    Connects to `postgres`, the maintenance database every server has. An absent
    *database* is something we can fix; an unreachable *server* is not, and its
    error propagates — a configured database that cannot be reached is a broken
    run, not an absent one.
    """
    target = make_url(_TEST_DATABASE_URL)
    admin = target.set(database="postgres")
    connection = psycopg2.connect(admin.render_as_string(hide_password=False))
    connection.autocommit = True  # CREATE DATABASE cannot run inside a transaction
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target.database,))
        if cursor.fetchone() is None:
            # Interpolated because an identifier cannot be a bind parameter. The
            # name comes from our own environment, and it is quoted.
            cursor.execute(f'CREATE DATABASE "{target.database}"')
    finally:
        connection.close()


def _upgrade_to_head() -> None:
    """Build the schema with Alembic, not `create_all`.

    `create_all` renders the models directly, which is not what deploys apply and
    not what production holds. Running the migrations is what puts the native enum
    types, the `TIMESTAMP WITH TIME ZONE` columns and the real foreign-key
    constraints in front of these tests. A subprocess, so it uses the same CLI
    path the pre-deploy job does.
    """
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": _TEST_DATABASE_URL},
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"`alembic upgrade head` failed ({result.returncode}) against "
            f"{make_url(_TEST_DATABASE_URL).render_as_string()}:\n"
            f"{result.stdout}\n{result.stderr}"
        )


@pytest.fixture(scope="session")
def _database():
    """A schema built from the migrations, once per session.

    Dropped and rebuilt rather than reused, so a run cannot inherit rows or a
    stale schema from the last one. `DROP SCHEMA ... CASCADE` also clears the
    enum types and `alembic_version`, which `DROP TABLE` would leave behind.
    """
    _create_database_if_absent()
    with _engine.begin() as connection:
        connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    _upgrade_to_head()
    yield
    _engine.dispose()


# Every table the models own. `alembic_version` is deliberately absent: truncating
# it would tell the next `upgrade` the schema is empty.
_TRUNCATE_TARGETS = ", ".join(f'public."{name}"' for name in Base.metadata.tables)


@pytest.fixture(autouse=True)
def _clean_database(request):
    """Empty every table before each test, then seed the acting users.

    Before rather than after, so a failing test leaves its rows in place to be
    inspected while the next test still starts from a known state. One `TRUNCATE`
    for all tables at once: separate statements would each need the FK graph
    walked, and `CASCADE` on already-empty tables is cheap.

    `tests/migrations` is exempt, and the marker is how: that suite manages its own
    schema in its own database and must not need this one to exist. Pulling
    `_database` in by name rather than declaring it makes that conditional — as an
    autouse session fixture it would build the application schema even for a run
    that only selected migration tests, so `pytest tests/migrations` would demand
    a database it never touches.
    """
    if request.node.get_closest_marker("migrations"):
        yield
        return

    request.getfixturevalue("_database")
    with _engine.begin() as connection:
        connection.execute(text(f"TRUNCATE {_TRUNCATE_TARGETS} RESTART IDENTITY CASCADE"))
    db = _TestSession()
    try:
        db.add_all([_fixture_user(role) for role in _FIXTURE_USERS])
        db.commit()
    finally:
        db.close()
    yield


class CapturedLog:
    """The bytes the configured logging pipeline wrote, parsed back into records."""

    def __init__(self, stream: io.StringIO):
        self._stream = stream

    def text(self) -> str:
        """Every byte written, unparsed — what a `grep` for a secret would see."""
        return self._stream.getvalue()

    def records(self) -> list[dict]:
        return [json.loads(line) for line in self._stream.getvalue().splitlines() if line]

    def messages(self) -> list[str]:
        return [record["message"] for record in self.records()]

    def tracebacks(self) -> list[dict]:
        """Only the records carrying a traceback — what a duplicate would show up in."""
        return [record for record in self.records() if "exception" in record]


@pytest.fixture
def log_stream():
    """Runs the real logging configuration with stdout swapped for a buffer.

    `dictConfig` resolves `sys.stdout` while it runs, so re-running `setup_logging`
    with the stream replaced captures exactly the bytes the configured pipeline
    writes. Asserting on those bytes is the only way to test what an operator sees:
    a logger's `.level` is a value the test just arranged, and says nothing about
    whether a record survived.

    Yields a callable that applies a level and returns the capture.
    """
    saved_stdout, saved_level = sys.stdout, settings.LOG_LEVEL

    def configure(level: str = "INFO") -> CapturedLog:
        stream = io.StringIO()
        sys.stdout = stream
        settings.LOG_LEVEL = level
        setup_logging()
        return CapturedLog(stream)

    yield configure

    sys.stdout, settings.LOG_LEVEL = saved_stdout, saved_level
    setup_logging()


@pytest.fixture(autouse=True)
def document_store():
    """The in-memory document store, injected in place of the real adapter.

    Autouse so no test can reach a real bucket: the real `get_document_store` builds
    the Spaces adapter from configuration, and a test that forgot to override it
    would sign and send a request to whatever `SPACES_*` names in the environment it
    happens to run in. Tests that care about the store take this fixture by name to
    arrange a forced failure or assert on the calls.
    """
    store = FakeDocumentStore()
    app.dependency_overrides[get_document_store] = lambda: store
    yield store
    app.dependency_overrides.pop(get_document_store, None)


@pytest.fixture
def db_session():
    """A direct DB session for arranging/asserting on rows the API doesn't expose
    (e.g. PitchContact join rows). Shares the engine with the app, and commits for
    real — `_clean_database` is what undoes the writes, not a rollback here."""
    db = _TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """Unauthenticated client.

    follow_redirects=False is deliberate: a stray 307 (the trailing-slash bug)
    must be visible to the assertions, not silently followed by httpx.
    """
    app.dependency_overrides[get_db] = _get_test_db
    with TestClient(app, follow_redirects=False) as c:
        yield c
    app.dependency_overrides.clear()


class _AuthenticatedTestClient:
    """Wrapper around TestClient that manages authentication per request.

    The override replaces `get_current_user` wholesale, so the real dependency —
    including the stamping of the acting user onto `request.state` for the access
    log — never runs. Requests made through these fixtures are therefore logged
    without a user, which is correct; don't "fix" it by widening the lambda.
    """

    def __init__(self, user):
        self.user = user
        app.dependency_overrides[get_db] = _get_test_db
        self.client = TestClient(app, follow_redirects=False)

    def _make_request(self, method, *args, **kwargs):
        # Set up the override just before making the request
        app.dependency_overrides[get_current_user] = lambda: self.user
        try:
            return method(*args, **kwargs)
        finally:
            # Clean up after the request
            app.dependency_overrides.pop(get_current_user, None)

    def get(self, *args, **kwargs):
        return self._make_request(self.client.get, *args, **kwargs)

    def post(self, *args, **kwargs):
        return self._make_request(self.client.post, *args, **kwargs)

    def patch(self, *args, **kwargs):
        return self._make_request(self.client.patch, *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self._make_request(self.client.delete, *args, **kwargs)

    def put(self, *args, **kwargs):
        return self._make_request(self.client.put, *args, **kwargs)

    def head(self, *args, **kwargs):
        return self._make_request(self.client.head, *args, **kwargs)

    def options(self, *args, **kwargs):
        return self._make_request(self.client.options, *args, **kwargs)


@pytest.fixture
def admin_client():
    """Client authenticated as an admin (auth dependency overridden)."""
    client = _AuthenticatedTestClient(_fixture_user(UserRole.ADMIN))
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def assessor_client():
    """Client authenticated as an assessor."""
    client = _AuthenticatedTestClient(_fixture_user(UserRole.ASSESSOR))
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def viewer_client():
    """Client authenticated as a viewer (read-only role)."""
    client = _AuthenticatedTestClient(_fixture_user(UserRole.VIEWER))
    yield client
    app.dependency_overrides.clear()
