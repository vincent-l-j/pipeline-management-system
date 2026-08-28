"""Every request gets a correlation id, echoed on the response and stamped on its records.

The middleware is exercised on a throwaway app rather than `app.main:app`: the
shared app singleton is what the rest of the suite asserts against, so adding
routes to it here would leak into other modules.
"""

import logging
import re

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.core.logging import RequestIdFilter
from app.core.request_context import REQUEST_ID_HEADER, install_request_context

ACCESS_LOGGER = "app.access"
ROUTE_LOGGER = "app.tests.request_context"

SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

# Everything the header is not allowed to be, in one value: a line break, a NUL, a
# payload shaped like a record of its own, and more length than is ever plausible.
HOSTILE_REQUEST_ID = (
    'a\r\n{"level": "ERROR", "logger": "app.access", "message": "forged"}\x00' + "b" * 200
)


@pytest.fixture(scope="module")
def client():
    test_app = FastAPI()

    @test_app.get("/echo")
    def echo():
        return {"ok": True}

    @test_app.get("/noisy")
    def noisy():
        logging.getLogger(ROUTE_LOGGER).info("handling the request")
        return {"ok": True}

    @test_app.get("/api/health")
    def health():
        return {"status": "ok"}

    @test_app.get("/api/health/ready")
    def ready():
        return JSONResponse({"status": "unavailable"}, status_code=503)

    install_request_context(test_app)
    return TestClient(test_app)


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
    client.get("/echo")

    (record,) = access_records()
    assert record.duration_ms >= 0


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
