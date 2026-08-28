"""Liveness and readiness probes.

Liveness must stay independent of the database: the deploy platform restarts any
instance that fails it, so a database outage answered with a failing liveness
probe would become a restart loop across otherwise-healthy instances.

The outage cases run against a real `Session` over a SQLite file that cannot be
opened, so `.execute` raises a genuine `OperationalError` — the same failure a
dead Postgres produces — rather than a hand-rolled stub that only resembles one.
"""

import json

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings, settings
from app.core.database import get_db
from app.main import app

_HEALTH_LOGGER = "app.api.routes.health"
_ACCESS_LOGGER = "app.access"
# The level the app ships with, read from the field's default rather than named
# here: the claim is about what an operator sees without configuring anything,
# and a level the test picked would only prove the test picked it.
_SHIPPED_LOG_LEVEL = Settings.model_fields["LOG_LEVEL"].default
# More than the ten-probe excerpt the assertion asks for evidence over.
_PROBE_ROUNDS = 6
_UNREACHABLE_DATABASE_URL = "sqlite:///file:no-such-db?mode=ro&uri=true"
_UnreachableSession = sessionmaker(bind=create_engine(_UNREACHABLE_DATABASE_URL))


def _access_records(captured) -> list[dict]:
    return [record for record in captured.records() if record["logger"] == _ACCESS_LOGGER]


def _unreachable_db():
    db = _UnreachableSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def database_down(client):
    """A client whose sessions point at a database that cannot be opened.

    The `client` fixture's teardown clears the overrides, so this survives a
    failing assertion without leaking into the next test.
    """
    app.dependency_overrides[get_db] = _unreachable_db
    return client


def test_liveness_returns_200(client):
    assert client.get("/api/health").status_code == 200


def test_liveness_returns_the_expected_payload(client):
    assert client.get("/api/health").json() == {"status": "ok", "app": "Rozetta PMS"}


def test_liveness_is_reachable_without_authentication(client):
    assert "Authorization" not in client.headers
    assert client.get("/api/health").status_code == 200


def test_liveness_returns_200_while_the_database_is_unreachable(database_down):
    assert database_down.get("/api/health").status_code == 200


def test_readiness_returns_200_when_the_database_is_reachable(client):
    assert client.get("/api/health/ready").status_code == 200


def test_readiness_reports_the_database_as_reachable(client):
    assert client.get("/api/health/ready").json()["database"] == "ok"


def test_readiness_reports_the_configured_version(client, monkeypatch):
    monkeypatch.setattr(settings, "APP_VERSION", "1.2.3-test")

    assert client.get("/api/health/ready").json()["version"] == "1.2.3-test"


def test_readiness_is_reachable_without_authentication(client):
    assert "Authorization" not in client.headers
    assert client.get("/api/health/ready").status_code == 200


def test_readiness_returns_503_when_the_database_is_unreachable(database_down):
    assert database_down.get("/api/health/ready").status_code == 503


def test_the_unavailable_readiness_body_reports_the_database_as_down(database_down):
    assert database_down.get("/api/health/ready").json()["database"] == "unreachable"


def test_the_unavailable_readiness_body_still_reports_the_version(database_down, monkeypatch):
    monkeypatch.setattr(settings, "APP_VERSION", "1.2.3-test")

    assert database_down.get("/api/health/ready").json()["version"] == "1.2.3-test"


def test_readiness_with_a_trailing_slash_is_not_found(client):
    assert client.get("/api/health/ready/").status_code == 404


def test_repeated_successful_probes_write_no_access_record(client, log_stream):
    """The platform polls liveness about every ten seconds, so at the shipped level
    routine probes must not reach the stream at all.

    Asserts on the bytes the configured pipeline wrote, not on a threshold the test
    set: a demotion that only holds while a test raises the level is no demotion.
    The trailing ordinary request is the control — without it an empty result would
    also be what a dead capture, or a silenced access logger, looks like.
    """
    captured = log_stream(_SHIPPED_LOG_LEVEL)

    for _ in range(_PROBE_ROUNDS):
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/health/ready").status_code == 200

    assert _access_records(captured) == []

    client.get("/api/users/me")
    assert [record["path"] for record in _access_records(captured)] == ["/api/users/me"]


def test_a_failing_readiness_probe_records_the_failure(database_down, log_stream):
    captured = log_stream("ERROR")

    database_down.get("/api/health/ready")

    (record,) = [r for r in captured.records() if r["logger"] == _HEALTH_LOGGER]
    assert record["level"] == "ERROR"
    assert record["error_type"] == "OperationalError"
    assert "unable to open database file" in record["error_message"]


def test_a_failing_readiness_probe_does_not_repeat_the_traceback(database_down, log_stream):
    """The platform polls readiness continuously, so a stack per poll buries the outage."""
    captured = log_stream("ERROR")

    database_down.get("/api/health/ready")
    database_down.get("/api/health/ready")

    assert captured.tracebacks() == []
    assert "Traceback" not in json.dumps(captured.records())
