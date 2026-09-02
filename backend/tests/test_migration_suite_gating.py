"""Tests for how the migration suite reacts to its database configuration.

Each case runs that suite in a subprocess, because what is under test is the
exit status of a whole pytest run — a session-scoped skip or error cannot be
observed from inside the run it governs.
"""

import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Port 1 is reserved and never listens, so the driver refuses immediately rather
# than hanging on a connect timeout.
UNREACHABLE_URL = "postgresql://pms:pms@127.0.0.1:1/pms_migrations_test"


def _run_migration_suite(env: dict[str, str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/migrations",
            "-m",
            "migrations",
            # -rs surfaces skip reasons, which are otherwise suppressed.
            "-rs",
            "-p",
            "no:cacheprovider",
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


def test_unconfigured_database_skips_with_a_reason():
    env = {k: v for k, v in os.environ.items() if k != "TEST_DATABASE_URL"}

    result = _run_migration_suite(env)

    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    assert "TEST_DATABASE_URL not set" in output, output
