"""Fixtures for the Alembic migration tests.

These tests exercise real Alembic migrations against a real PostgreSQL database —
NOT the in-memory SQLite used by the rest of the suite (see the top-level
tests/conftest.py). Migrations are Postgres-specific (enums, UUID, server
defaults); SQLite cannot faithfully test them.

They are skipped unless a throwaway Postgres is available. Point them at one with:

    TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/pms_migrations_test \\
        pytest tests/migrations -m migrations

The database is wiped (DROP SCHEMA public CASCADE) between tests, so it MUST be a
disposable database, never a real one.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

# backend/ — the directory containing alembic.ini.
BACKEND_DIR = Path(__file__).resolve().parents[2]
VERSIONS_DIR = BACKEND_DIR / "alembic" / "versions"


def _reachable(url: str) -> bool:
    try:
        import psycopg2

        conn = psycopg2.connect(url)
        conn.close()
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def pg_url() -> str:
    """The disposable Postgres URL, or skip the whole module if unavailable."""
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip(
            "TEST_DATABASE_URL not set — migration tests need a disposable Postgres. "
            "See tests/migrations/conftest.py for how to run them."
        )
    if not _reachable(url):
        pytest.skip(f"TEST_DATABASE_URL is set but not reachable: {url}")
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

    Runs in a subprocess with DATABASE_URL pointed at the test database, so it
    gets a fresh `settings` (the in-process one is pinned to SQLite by the root
    conftest) and exercises the exact CLI path the deploy job uses.
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
