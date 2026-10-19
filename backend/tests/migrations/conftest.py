"""Fixtures for the Alembic migration tests.

These tests exercise the migrations themselves — that they apply, reverse, stay
linear, and carry data across a shape change. The rest of the suite exercises the
application against a schema the migrations have already built (see the top-level
tests/conftest.py); this module is what proves that schema is the one they
produce.

It needs a database of its **own**, and that is the reason for a second variable.
The schema here is wiped with `DROP SCHEMA public CASCADE` between tests, which
would pull the application suite's schema out from under it if they shared one.
So `TEST_DATABASE_URL` must not name the same database as
`APP_TEST_DATABASE_URL`; both are disposable, never a real one.

    TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/pms_migrations_test \\
        pytest tests/migrations

TEST_DATABASE_URL defaults to `pms_migrations_test` on the compose `db` service.
The database is created if absent, but an unreachable server fails the run with
the driver's error rather than skipping.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from tests.postgres import create_database_if_absent, migration_test_database_url

# backend/ — the directory containing alembic.ini.
BACKEND_DIR = Path(__file__).resolve().parents[2]
VERSIONS_DIR = BACKEND_DIR / "alembic" / "versions"


@pytest.fixture(scope="session")
def pg_url() -> str:
    """The disposable Postgres URL, its database created if absent."""
    url = migration_test_database_url()
    create_database_if_absent(url)
    return url


@pytest.fixture(scope="session", autouse=True)
def _require_migrations(pg_url):
    """Skip if no migrations have been authored yet (empty versions/)."""
    revisions = [p for p in VERSIONS_DIR.glob("*.py") if p.name != "__init__.py"]
    if not revisions:
        pytest.skip(
            "No migrations in alembic/versions yet. Generate a baseline first:\n"
            "    DATABASE_URL=$TEST_DATABASE_URL alembic revision --autogenerate -m baseline"
        )


@pytest.fixture
def alembic(pg_url):
    """Return a runner that invokes the Alembic CLI against the test DB.

    Runs in a subprocess with DATABASE_URL pointed at *this module's* database, so
    it gets a fresh `settings` — the in-process one is pinned to the application
    suite's database by the root conftest, which this must not touch — and
    exercises the exact CLI path the deploy job uses.
    """

    def run(*args: str, check: bool = True) -> subprocess.CompletedProcess:
        env = {**os.environ, "DATABASE_URL": pg_url}
        result = subprocess.run(
            ["alembic", *args],
            cwd=BACKEND_DIR,
            env=env,
            capture_output=True,
            text=True,
        )
        if check and result.returncode != 0:
            sys.stdout.write(result.stdout)
            sys.stderr.write(result.stderr)
            raise AssertionError(
                f"`alembic {' '.join(args)}` failed ({result.returncode}):\n"
                f"{result.stdout}\n{result.stderr}"
            )
        return result

    return run


@pytest.fixture
def clean_db(pg_url):
    """Reset the test DB to an empty public schema before each test.

    DROP SCHEMA ... CASCADE also clears leftover enum types and the
    alembic_version table, so every test starts from a truly clean slate.
    """
    from sqlalchemy import create_engine, text

    engine = create_engine(pg_url, poolclass=None)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    engine.dispose()
    yield
