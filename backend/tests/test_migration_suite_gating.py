"""Tests for how the migration suite reacts to its database configuration.

Each case runs that suite in a subprocess, because what is under test is the
outcome of a whole pytest run — a session fixture's error cannot be observed
from inside the run it governs.
"""

import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy.engine import make_url

from tests.postgres import app_test_database_url, database_exists, drop_database

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Port 1 is reserved and never listens, so the driver refuses immediately rather
# than hanging on a connect timeout.
UNREACHABLE_URL = "postgresql://pms:pms@127.0.0.1:1/pms_migrations_test"


def _run_migration_suite(env: dict[str, str], *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/migrations",
            "-m",
            "migrations",
            "-p",
            "no:cacheprovider",
            *args,
        ],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=120,
    )


def test_unreachable_database_fails_the_run_with_the_driver_error():
    result = _run_migration_suite({**os.environ, "TEST_DATABASE_URL": UNREACHABLE_URL})

    output = result.stdout + result.stderr
    assert result.returncode != 0, output
    assert "Connection refused" in output, output


@pytest.fixture
def absent_database_url():
    target = make_url(app_test_database_url()).set(database=f"pms_absent_{uuid.uuid4().hex}")
    url = target.render_as_string(hide_password=False)
    yield url
    drop_database(url)


def test_absent_database_is_created(absent_database_url):
    result = _run_migration_suite(
        {**os.environ, "TEST_DATABASE_URL": absent_database_url}, "--setup-only"
    )

    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    assert database_exists(absent_database_url)
