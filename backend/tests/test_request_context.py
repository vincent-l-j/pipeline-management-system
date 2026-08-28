"""Every request gets a correlation id, echoed on the response and stamped on its records.

The middleware is exercised on a throwaway app rather than `app.main:app`: the
shared app singleton is what the rest of the suite asserts against, so adding
routes to it here would leak into other modules.
"""

import logging
import re
import time

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.core.logging import RequestIdFilter
from app.core.request_context import REQUEST_ID_HEADER, install_request_context
from app.core.security import get_current_user
from app.main import app as real_app

ACCESS_LOGGER = "app.access"
ERROR_LOGGER = "app.error"
ROUTE_LOGGER = "app.tests.request_context"

SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

# Everything the header is not allowed to be, in one value: a line break, a NUL, a
# payload shaped like a record of its own, and more length than is ever plausible.
HOSTILE_REQUEST_ID = (
    'a\r\n{"level": "ERROR", "logger": "app.access", "message": "forged"}\x00' + "b" * 200
)

SERVER_LOGGER = "uvicorn.error"

# Distinctive enough that finding it anywhere in a response proves the failure
# leaked, and shaped like the internals a real traceback would expose.
FAILURE_MESSAGE = "connection to /var/run/postgres refused while selecting from pitches"

# Long enough that a duration reported as anything other than elapsed milliseconds
# — a hardcoded zero, or seconds — cannot clear the assertion.
SLOW_ROUTE_SECONDS = 0.05
SLOW_ROUTE_MS = SLOW_ROUTE_SECONDS * 1000


@pytest.fixture(scope="module")
def test_app():
    app = FastAPI()

    @app.get("/echo")
    def echo():
        return {"ok": True}

    @app.get("/noisy")
    def noisy():
        logging.getLogger(ROUTE_LOGGER).info("handling the request")
        return {"ok": True}

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/health/ready")
    def ready():
        return JSONResponse({"status": "unavailable"}, status_code=503)

    @app.get("/slow")
    def slow():
        time.sleep(SLOW_ROUTE_SECONDS)
        return {"ok": True}

    @app.get("/boom")
    def boom():
        raise RuntimeError(FAILURE_MESSAGE)

    @app.get("/missing")
    def missing():
        raise HTTPException(status_code=404, detail="Nope")

    install_request_context(app)
    return app


@pytest.fixture(scope="module")
def client(test_app):
    return TestClient(test_app)


@pytest.fixture(scope="module")
def failing_client(test_app):
    """A client that returns the error response instead of re-raising it.

    TestClient re-raises whatever the app failed with by default, which would
    hide the very response under test.
    """
    return TestClient(test_app, raise_server_exceptions=False)


@pytest.fixture
def error_records(caplog):
    caplog.set_level(logging.ERROR, logger=ERROR_LOGGER)
    yield lambda: [record for record in caplog.records if record.name == ERROR_LOGGER]


@pytest.fixture
def access_records(caplog):
    """Captured `app.access` records, with the request id resolved onto each.

    The filter that stamps `request_id` lives on the stdout handler, so caplog's
    own handler needs its own copy to see the attribute.
    """
    caplog.handler.addFilter(RequestIdFilter())
    caplog.set_level(logging.INFO, logger=ACCESS_LOGGER)
    yield lambda: [record for record in caplog.records if record.name == ACCESS_LOGGER]


def test_response_carries_a_generated_request_id(client):
    response = client.get("/echo")

    assert SAFE_REQUEST_ID.fullmatch(response.headers[REQUEST_ID_HEADER])


def test_a_safe_inbound_request_id_is_reused(client):
    response = client.get("/echo", headers={REQUEST_ID_HEADER: "abc-123"})

    assert response.headers[REQUEST_ID_HEADER] == "abc-123"


def test_a_request_id_carrying_a_newline_is_replaced(client):
    hostile = "abc\ninjected"

    response = client.get("/echo", headers={REQUEST_ID_HEADER: hostile})

    returned = response.headers[REQUEST_ID_HEADER]
    assert returned != hostile
    assert SAFE_REQUEST_ID.fullmatch(returned)


def test_an_over_long_request_id_is_replaced(client):
    over_long = "a" * 200

    response = client.get("/echo", headers={REQUEST_ID_HEADER: over_long})

    returned = response.headers[REQUEST_ID_HEADER]
    assert returned != over_long
    assert SAFE_REQUEST_ID.fullmatch(returned)


def test_a_hostile_request_id_leaves_one_record_per_line_in_the_stream(client, log_stream):
    """The other half of the same defence: the header must not forge a log record.

    Replacing the value in the response is not enough on its own — the id is written
    into the stream as well, so this reads the bytes the configured pipeline produced.
    `records()` parses each line on its own, so a break smuggled through the header
    leaves fragments that are not JSON and the parse fails. The hostile value claims
    to be an `app.access` record itself, so a forged one would also show up as a
    second entry here rather than as a line nobody looks at.
    """
    captured = log_stream()

    response = client.get("/echo", headers={REQUEST_ID_HEADER: HOSTILE_REQUEST_ID})

    (record,) = [r for r in captured.records() if r["logger"] == ACCESS_LOGGER]
    assert record["message"] == "Request handled"
    assert record["request_id"] == response.headers[REQUEST_ID_HEADER]
    assert SAFE_REQUEST_ID.fullmatch(record["request_id"])


def test_sequential_requests_get_distinct_request_ids(client):
    first = client.get("/echo").headers[REQUEST_ID_HEADER]
    second = client.get("/echo").headers[REQUEST_ID_HEADER]

    assert first != second


def test_the_access_record_carries_the_method_path_and_status(client, access_records):
    client.get("/echo")

    (record,) = access_records()
    assert record.method == "GET"
    assert record.path == "/echo"
    assert record.status_code == 200


def test_the_access_record_carries_the_elapsed_duration(client, access_records):
    """A route that is known to take time must report at least that much time.

    `>= 0` would pass against a hardcoded zero, so the route sleeps a known
    interval and the record has to account for it, in milliseconds.
    """
    client.get("/slow")

    (record,) = access_records()
    assert record.duration_ms >= SLOW_ROUTE_MS
    # Guards the other direction: seconds or nanoseconds would miss this window.
    assert record.duration_ms < SLOW_ROUTE_MS * 100


def test_the_access_record_carries_the_id_returned_to_the_caller(client, access_records):
    response = client.get("/echo")

    (record,) = access_records()
    assert record.request_id == response.headers[REQUEST_ID_HEADER]


def test_a_record_from_the_route_carries_the_request_id(client, caplog):
    caplog.handler.addFilter(RequestIdFilter())
    caplog.set_level(logging.INFO, logger=ROUTE_LOGGER)

    response = client.get("/noisy")

    (record,) = [r for r in caplog.records if r.name == ROUTE_LOGGER]
    assert record.request_id == response.headers[REQUEST_ID_HEADER]


def test_the_query_string_is_not_logged(client, access_records):
    client.get("/echo", params={"q": "confidential"})

    (record,) = access_records()
    assert record.path == "/echo"


def test_a_successful_health_probe_is_not_recorded_at_the_default_level(client, access_records):
    client.get("/api/health")

    assert access_records() == []


def test_a_failing_readiness_probe_is_recorded(client, access_records):
    client.get("/api/health/ready")

    (record,) = access_records()
    assert record.status_code == 503


def test_an_unhandled_exception_returns_a_server_error(failing_client):
    response = failing_client.get("/boom")

    assert response.status_code == 500


def test_the_server_error_body_carries_the_id_from_the_header(failing_client):
    response = failing_client.get("/boom")

    request_id = response.json()["request_id"]
    assert SAFE_REQUEST_ID.fullmatch(request_id)
    assert request_id == response.headers[REQUEST_ID_HEADER]


def test_the_server_error_reveals_nothing_about_the_failure(failing_client):
    response = failing_client.get("/boom")

    body = response.json()
    assert body["detail"] == "Internal server error"
    assert set(body) == {"detail", "request_id"}
    assert FAILURE_MESSAGE not in response.text
    assert "Traceback" not in response.text


def test_the_failure_is_logged_with_its_traceback(failing_client, error_records):
    failing_client.get("/boom")

    (record,) = error_records()
    assert record.levelno == logging.ERROR
    assert record.exc_info is not None
    assert FAILURE_MESSAGE in logging.Formatter().formatException(record.exc_info)


def test_an_unhandled_exception_leaves_exactly_one_traceback_in_the_stream(client, log_stream):
    """Registering a handler adds a record; the web server still logs the failure too.

    `TestClient` re-raises whatever escaped the app at the point uvicorn's
    `run_asgi` catches it, so logging it here reproduces the server's second
    record — the one with no request id on it. Only ours may survive.
    """
    captured = log_stream()

    with pytest.raises(RuntimeError) as escaped:
        client.get("/boom", headers={REQUEST_ID_HEADER: "trace-once"})
    logging.getLogger(SERVER_LOGGER).error(
        "Exception in ASGI application\n", exc_info=escaped.value
    )

    tracebacks = captured.tracebacks()
    assert len(tracebacks) == 1
    assert tracebacks[0]["request_id"] == "trace-once"
    assert FAILURE_MESSAGE in tracebacks[0]["exception"]


def test_the_logged_failure_carries_the_method_and_path(failing_client, error_records):
    failing_client.get("/boom")

    (record,) = error_records()
    assert record.method == "GET"
    assert record.path == "/boom"


def test_the_logged_failure_carries_the_id_returned_to_the_caller(failing_client, error_records):
    response = failing_client.get("/boom")

    (record,) = error_records()
    assert record.request_id == response.json()["request_id"]


def test_an_expected_error_keeps_its_detail_only_body(client):
    response = client.get("/missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "Nope"}


def test_a_failing_dependency_on_the_real_app_returns_a_correlated_server_error():
    """The wiring holds on `app.main:app`, not just on a throwaway app.

    A dependency override stands in for the deliberately failing route the other
    cases use — production code must not carry one.
    """

    def explode():
        raise RuntimeError(FAILURE_MESSAGE)

    real_app.dependency_overrides[get_current_user] = explode
    try:
        response = TestClient(real_app, raise_server_exceptions=False).get("/api/pitches")
    finally:
        real_app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 500
    assert response.json() == {
        "detail": "Internal server error",
        "request_id": response.headers[REQUEST_ID_HEADER],
    }
    assert FAILURE_MESSAGE not in response.text
