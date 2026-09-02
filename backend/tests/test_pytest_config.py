"""Tests for the suite's own pytest configuration.

Each case runs pytest in a subprocess against the repo's `pytest.ini`, because
the behaviour under test is what that config does at collection time — it cannot
be observed from inside a run that has already collected.
"""

import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
PYTEST_INI = BACKEND_DIR / "pytest.ini"


def _run_pytest(*args: str) -> subprocess.CompletedProcess:
    # -c/--rootdir pin the config under test; the temp files live outside backend/,
    # where pytest's own rootdir search would not find pytest.ini.
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-c",
            str(PYTEST_INI),
            "--rootdir",
            str(BACKEND_DIR),
            "-p",
            "no:cacheprovider",
            *args,
        ],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
    )


def test_undeclared_marker_fails_the_run_and_names_the_marker(tmp_path):
    test_file = tmp_path / "test_undeclared_marker.py"
    test_file.write_text(
        "import pytest\n\n\n@pytest.mark.migratons\ndef test_typo():\n    assert True\n"
    )

    result = _run_pytest(str(test_file))

    assert result.returncode != 0
    assert "migratons" in result.stdout + result.stderr


def test_declared_marker_runs(tmp_path):
    test_file = tmp_path / "test_declared_marker.py"
    test_file.write_text(
        "import pytest\n\n\n@pytest.mark.migrations\ndef test_declared():\n    assert True\n"
    )

    result = _run_pytest(str(test_file))

    assert result.returncode == 0, result.stdout + result.stderr


def test_declared_marker_still_selects_the_migration_suite():
    result = _run_pytest("tests/migrations", "-m", "migrations", "--collect-only", "-q")

    assert result.returncode == 0, result.stdout + result.stderr
    assert "no tests ran" not in result.stdout
    assert "test" in result.stdout
