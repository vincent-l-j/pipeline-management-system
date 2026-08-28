"""Browser error reports are accepted from any signed-in user and written to the log stream.

The records are captured through `caplog`; `conftest.py` pins `LOG_LEVEL=WARNING`
before the app is imported, so each test raises the level on the client-error
logger itself rather than relying on the process default.
"""

import logging

import pytest

from app.core.logging import JsonFormatter
from app.core.request_context import REQUEST_ID_HEADER
from app.schemas.client_error import MAX_MESSAGE_LENGTH, MAX_STACK_LENGTH

CLIENT_ERROR_LOGGER = "app.client_errors"

ENDPOINT = "/api/client-errors"

REPORT = {
    "message": "Cannot read properties of undefined (reading 'title')",
    "url": "/pitches/3f1c",
    "stack": "TypeError: Cannot read properties of undefined\n    at PitchDetail",
    "component_stack": "    in PitchDetail\n    in ErrorBoundary",
}

# Shaped like the token the sign-in redirect really carries, so a test that lets
# it through fails for the same reason production would.
JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.6Ck-fFCFN9Wq1cX0aQ1sBw"

# The free-text fields a browser can put a URL in. `message` is the one the first
# version of this rule missed.
TEXT_FIELDS = ["message", "stack", "component_stack"]


@pytest.fixture
def error_records(caplog):
    caplog.set_level(logging.ERROR, logger=CLIENT_ERROR_LOGGER)
    yield lambda: [record for record in caplog.records if record.name == CLIENT_ERROR_LOGGER]


def test_an_authenticated_report_is_accepted(admin_client):
    response = admin_client.post(ENDPOINT, json=REPORT)

    assert response.status_code == 202


def test_the_acknowledgement_carries_the_correlating_request_id(admin_client):
    response = admin_client.post(ENDPOINT, json=REPORT)

    assert response.json()["request_id"] == response.headers[REQUEST_ID_HEADER]


def test_the_report_is_logged_at_error_severity(admin_client, error_records):
    admin_client.post(ENDPOINT, json=REPORT)

    (record,) = error_records()
    assert record.levelno == logging.ERROR


def test_the_record_carries_the_reported_message_and_url(admin_client, error_records):
    admin_client.post(ENDPOINT, json=REPORT)

    (record,) = error_records()
    assert record.client_message == REPORT["message"]
    assert record.client_url == REPORT["url"]


@pytest.mark.parametrize(
    ("reported", "logged"),
    [
        ("/pitches/3f1c", "/pitches/3f1c"),
        ("http://localhost:5173/pitches/3f1c", "http://localhost:5173/pitches/3f1c"),
        ("/auth/callback?token=abc", "/auth/callback"),
        ("/pitches?stage=triage&q=solar", "/pitches"),
        ("/pitches#row-4", "/pitches"),
        ("/auth/callback#access_token=abc", "/auth/callback"),
        # A percent-encoded separator is the separator it encodes: splitting on the
        # literal character alone let a whole query through.
        ("/auth/callback%3Ftoken=abc", "/auth/callback"),
        ("/auth/callback%3ftoken=abc", "/auth/callback"),
        ("/pitches%23row-4", "/pitches"),
        ("/pitches%3Fstage=triage%23row-4", "/pitches"),
    ],
)
def test_the_logged_url_keeps_the_path_and_drops_the_rest(
    admin_client, error_records, reported, logged
):
    admin_client.post(ENDPOINT, json={**REPORT, "url": reported})

    (record,) = error_records()
    assert record.client_url == logged


def test_a_token_in_the_reported_url_reaches_no_part_of_the_record(admin_client, error_records):
    """The whole point of dropping the query: a sign-in redirect carries a live JWT.

    Asserting on the formatted record rather than on `client_url` alone is
    deliberate — the value must not survive anywhere in the line that is written.
    """
    token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.6Ck-fFCFN9Wq1cX0aQ1sBw"

    admin_client.post(
        ENDPOINT, json={**REPORT, "url": f"http://localhost:5173/auth/callback?token={token}"}
    )

    (record,) = error_records()
    formatted = JsonFormatter().format(record)
    assert token not in formatted


@pytest.mark.parametrize("separator", ["%3F", "%3f", "%23"])
def test_an_encoded_separator_does_not_smuggle_a_token_into_the_record(
    admin_client, error_records, separator
):
    """Splitting on the literal `?` and `#` only was defeated by encoding them."""
    admin_client.post(ENDPOINT, json={**REPORT, "url": f"/auth/callback{separator}token={JWT}"})

    (record,) = error_records()
    assert JWT not in JsonFormatter().format(record)
    assert record.client_url == "/auth/callback"


def test_a_doubly_encoded_separator_still_loses_the_token(admin_client, error_records):
    admin_client.post(ENDPOINT, json={**REPORT, "url": f"/auth/callback%253Ftoken={JWT}"})

    (record,) = error_records()
    assert JWT not in JsonFormatter().format(record)
    assert record.client_url == "/auth/callback"


def test_a_credential_in_a_path_segment_is_redacted(admin_client, error_records):
    """The second layer covers what dropping the query cannot: there is no query here."""
    admin_client.post(ENDPOINT, json={**REPORT, "url": f"/auth/callback/token={JWT}"})

    (record,) = error_records()
    assert JWT not in JsonFormatter().format(record)
    assert record.client_url == "/auth/callback/token=REDACTED"


@pytest.mark.parametrize("field", TEXT_FIELDS)
@pytest.mark.parametrize("separator", ["%3F", "%3f", "%253F"])
def test_an_encoded_separator_in_free_text_does_not_hide_a_token(
    admin_client, error_records, field, separator
):
    """Free text has no query to drop, so the escape must not defeat the match either."""
    admin_client.post(
        ENDPOINT, json={**REPORT, field: f"failed GET /auth/callback{separator}token={JWT} (401)"}
    )

    (record,) = error_records()
    assert JWT not in JsonFormatter().format(record)
    logged = getattr(record, f"client_{field}")
    assert logged == f"failed GET /auth/callback{separator}token=REDACTED (401)"


@pytest.mark.parametrize("field", TEXT_FIELDS)
def test_a_token_quoted_in_a_free_text_field_is_redacted(admin_client, error_records, field):
    """An `Error` whose text quotes a URL is completely ordinary.

    `axios` messages, fetch failures and stack frames all carry URLs, so a rule
    that covers `url` alone covers one field of four.
    """
    admin_client.post(
        ENDPOINT, json={**REPORT, field: f"failed GET /auth/callback?token={JWT} (401)"}
    )

    (record,) = error_records()
    assert JWT not in JsonFormatter().format(record)
    assert getattr(record, f"client_{field}") == "failed GET /auth/callback?token=REDACTED (401)"


@pytest.mark.parametrize(
    "parameter",
    [
        "token",
        "access_token",
        "id_token",
        "refresh_token",
        "code",
        "secret",
        "client_secret",
        "password",
        "api_key",
        "apikey",
        "key",
        "authorization",
        "signature",
        # Case is the caller's choice, not ours.
        "Token",
        "ACCESS_TOKEN",
    ],
)
def test_every_credential_shaped_parameter_loses_its_value(admin_client, error_records, parameter):
    admin_client.post(ENDPOINT, json={**REPORT, "message": f"GET /x?{parameter}={JWT} failed"})

    (record,) = error_records()
    assert JWT not in JsonFormatter().format(record)
    assert record.client_message == f"GET /x?{parameter}=REDACTED failed"


def test_a_credential_in_the_correlation_id_is_redacted_too(admin_client, error_records):
    """Every caller-supplied field, not a chosen few — that is what was wrong before."""
    admin_client.post(ENDPOINT, json={**REPORT, "correlated_request_id": "token=abcdef123456"})

    (record,) = error_records()
    assert record.client_correlated_request_id == "token=REDACTED"


def test_an_ordinary_report_is_logged_word_for_word(admin_client, error_records):
    """No over-redaction: the common case must survive untouched."""
    admin_client.post(ENDPOINT, json=REPORT)

    (record,) = error_records()
    assert record.client_message == REPORT["message"]
    assert record.client_url == REPORT["url"]
    assert record.client_stack == REPORT["stack"]
    assert record.client_component_stack == REPORT["component_stack"]


@pytest.mark.parametrize(
    "message",
    [
        "failed GET /pitches?stage=triage&q=solar",
        "Warning: each child in a list needs a unique key prop",
        "Unexpected token < in JSON at position 0",
        "assignment to constant variable: total = 3",
        # A name is matched exactly, so a word that merely ends in one keeps its
        # value: over-redaction costs diagnostic information too.
        "geocoding failed for zipcode=90210",
        "request rejected (error_code=422)",
    ],
)
def test_a_message_with_no_credential_in_it_is_left_alone(admin_client, error_records, message):
    admin_client.post(ENDPOINT, json={**REPORT, "message": message})

    (record,) = error_records()
    assert record.client_message == message


def test_a_stack_carrying_several_urls_keeps_every_frame(admin_client, error_records):
    """A redaction that mangles a stack trades one blind spot for another."""
    stack = "\n".join(
        [
            "TypeError: Cannot read properties of undefined",
            f"    at fetchPitch (http://localhost:5173/assets/index.js?token={JWT})",
            "    at PitchDetail (http://localhost:5173/assets/index.js:44:3)",
            f"    at signIn (http://localhost:5173/auth/callback?code={JWT}&state=xyz)",
        ]
    )

    admin_client.post(ENDPOINT, json={**REPORT, "stack": stack})

    (record,) = error_records()
    assert JWT not in JsonFormatter().format(record)
    logged = record.client_stack
    assert logged.count("\n") == 3
    assert logged.startswith("TypeError: Cannot read properties of undefined\n")
    assert "    at fetchPitch (http://localhost:5173/assets/index.js?token=REDACTED)" in logged
    assert "    at PitchDetail (http://localhost:5173/assets/index.js:44:3)" in logged
    # The parameter name and the neighbouring parameter both survive, so the frame
    # still says what it was doing.
    assert "    at signIn (http://localhost:5173/auth/callback?code=REDACTED&state=xyz)" in logged


@pytest.mark.parametrize("reported", ["?token=abc", "#access_token=abc", "?", "#"])
def test_a_url_that_is_only_a_query_records_that_it_had_no_path(
    admin_client, error_records, reported
):
    """An empty `client_url` reads as a bug in the reporter; say what happened instead."""
    response = admin_client.post(ENDPOINT, json={**REPORT, "url": reported})

    assert response.status_code == 202
    (record,) = error_records()
    assert record.client_url == "(no path)"


def test_the_record_carries_the_reported_component_stack(admin_client, error_records):
    admin_client.post(ENDPOINT, json=REPORT)

    (record,) = error_records()
    assert record.client_component_stack == REPORT["component_stack"]


def test_the_record_identifies_the_authenticated_user(admin_client, error_records):
    admin_client.post(ENDPOINT, json=REPORT)

    (record,) = error_records()
    assert record.user_id == str(admin_client.user.id)
    assert record.user_role == admin_client.user.role.value


def test_a_report_containing_newlines_formats_to_exactly_one_line(admin_client, error_records):
    hostile = 'boom"}\n{"level": "ERROR", "message": "forged record"}'

    admin_client.post(ENDPOINT, json={**REPORT, "message": hostile})

    (record,) = error_records()
    formatted = JsonFormatter().format(record)
    assert "\n" not in formatted
    assert record.client_message == hostile


def test_a_body_claiming_another_role_does_not_change_the_logged_role(viewer_client, error_records):
    response = viewer_client.post(ENDPOINT, json={**REPORT, "user_role": "admin"})

    assert response.status_code == 202
    (record,) = error_records()
    assert record.user_role == viewer_client.user.role.value


def test_an_unauthenticated_report_is_rejected(client, error_records):
    response = client.post(ENDPOINT, json=REPORT)

    assert response.status_code == 403
    assert error_records() == []


def test_a_report_with_an_invalid_token_is_rejected(client, error_records):
    response = client.post(ENDPOINT, json=REPORT, headers={"Authorization": "Bearer not-a-token"})

    assert response.status_code == 401
    assert error_records() == []


def test_a_report_without_a_message_is_rejected(admin_client):
    response = admin_client.post(ENDPOINT, json={"url": REPORT["url"]})

    assert response.status_code == 422


def test_an_over_long_message_is_rejected(admin_client, error_records):
    response = admin_client.post(
        ENDPOINT, json={**REPORT, "message": "x" * (MAX_MESSAGE_LENGTH + 1)}
    )

    assert response.status_code == 422
    assert error_records() == []


def test_an_over_long_stack_is_rejected(admin_client, error_records):
    response = admin_client.post(ENDPOINT, json={**REPORT, "stack": "x" * (MAX_STACK_LENGTH + 1)})

    assert response.status_code == 422
    assert error_records() == []


def test_an_unknown_field_is_ignored_rather_than_rejected(admin_client):
    response = admin_client.post(ENDPOINT, json={**REPORT, "browser_version": "141.0"})

    assert response.status_code == 202


def test_a_trailing_slash_is_not_served(admin_client):
    response = admin_client.post(f"{ENDPOINT}/", json=REPORT)

    assert response.status_code == 404


@pytest.mark.parametrize("role_client", ["admin_client", "assessor_client", "viewer_client"])
def test_every_role_may_report_an_error(role_client, request):
    """Reporting is open to every signed-in role, viewers included.

    A browser error happens to whoever is looking at the page, so narrowing this
    to the roles that may change data would silently drop most reports. Anyone
    tempted to restrict it should read that as the deliberate design, not an
    oversight.
    """
    response = request.getfixturevalue(role_client).post(ENDPOINT, json=REPORT)

    assert response.status_code == 202
