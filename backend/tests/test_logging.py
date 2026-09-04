"""Log records are single-line JSON on stdout, and the web server's loggers share it."""

import io
import json
import logging
import uuid

import pytest

from app.core.logging import JsonFormatter, mark_traceback_logged, setup_logging


@pytest.fixture
def restore_logging():
    """Re-apply the real configuration after a test has changed the settings it reads."""
    yield
    setup_logging()


def _format(record: logging.LogRecord, **formatter_kwargs) -> str:
    return JsonFormatter(**formatter_kwargs).format(record)


def _make_record(message: str = "hello", level: int = logging.INFO, **extra) -> logging.LogRecord:
    record = logging.getLogger("app.test").makeRecord(
        "app.test", level, "test.py", 1, message, None, None
    )
    record.__dict__.update(extra)
    return record


def test_formatter_emits_a_single_line_for_a_multiline_message():
    output = _format(_make_record("first line\nsecond line"))

    assert "\n" not in output
    assert json.loads(output)["message"] == "first line\nsecond line"


def test_formatter_records_the_level_logger_and_message():
    payload = json.loads(_format(_make_record("something happened", level=logging.WARNING)))

    assert payload["level"] == "WARNING"
    assert payload["logger"] == "app.test"
    assert payload["message"] == "something happened"


def test_formatter_records_a_timestamp():
    payload = json.loads(_format(_make_record()))

    assert payload["timestamp"]


def test_formatter_includes_the_configured_environment():
    payload = json.loads(_format(_make_record(), environment="staging"))

    assert payload["environment"] == "staging"


def test_extra_values_become_top_level_fields():
    payload = json.loads(_format(_make_record(pitch_reference="PMS-1")))

    assert payload["pitch_reference"] == "PMS-1"


def test_a_value_that_is_not_json_serialisable_is_rendered_as_a_string():
    identifier = uuid.uuid4()

    payload = json.loads(_format(_make_record(pitch_id=identifier)))

    assert payload["pitch_id"] == str(identifier)


def test_an_exception_is_reported_as_a_traceback_on_one_line():
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("app.test.exception")
    logger.addHandler(handler)
    logger.setLevel(logging.ERROR)
    try:
        raise ValueError("boom")
    except ValueError:
        logger.exception("failed")
    finally:
        logger.removeHandler(handler)

    output = stream.getvalue().rstrip("\n")

    assert "\n" not in output
    payload = json.loads(output)
    assert "Traceback" in payload["exception"]
    assert "ValueError: boom" in payload["exception"]


def test_setup_removes_the_web_server_access_handlers():
    setup_logging()

    assert logging.getLogger("uvicorn.access").handlers == []


@pytest.mark.parametrize("name", ["uvicorn", "uvicorn.error", "uvicorn.access"])
def test_setup_leaves_the_web_server_loggers_propagating(name):
    setup_logging()

    assert logging.getLogger(name).propagate is True


def test_setup_leaves_loggers_created_beforehand_enabled():
    logger = logging.getLogger("app.created.before.setup")

    setup_logging()

    assert logger.disabled is False


# The cases below assert on the bytes the configured pipeline actually wrote (the
# `log_stream` fixture), because that is what an operator reads. A logger's level
# or handler list is state the test arranged, and can be right while the stream is
# still wrong.

SERVER_LOGGER = "uvicorn.error"
SERVER_ACCESS_LOGGER = "uvicorn.access"
APP_LOGGER = "app.tests.logging"


def _raised(message: str) -> Exception:
    """A genuinely raised exception, so a record built from it carries a traceback."""
    try:
        raise RuntimeError(message)
    except RuntimeError as exc:
        return exc


def _relog_as_the_web_server_would(exc: Exception) -> None:
    """What uvicorn's `run_asgi` does with anything that escapes the application."""
    logging.getLogger(SERVER_LOGGER).error("Exception in ASGI application\n", exc_info=exc)


def test_a_web_server_record_is_written_once_and_as_json(log_stream):
    captured = log_stream()

    logging.getLogger(SERVER_LOGGER).info("Started server process [%d]", 486539)

    assert captured.messages() == ["Started server process [486539]"]


@pytest.mark.parametrize(
    "message",
    ["Started server process [486539]", "Application startup complete.", "Shutting down"],
)
def test_the_web_servers_lifecycle_records_reach_the_stream(log_stream, message):
    captured = log_stream()

    logging.getLogger(SERVER_LOGGER).info(message)

    assert message in captured.messages()


def test_the_web_servers_invalid_request_warning_reaches_the_stream(log_stream):
    captured = log_stream()

    logging.getLogger(SERVER_LOGGER).warning("Invalid HTTP request received.")

    assert "Invalid HTTP request received." in captured.messages()


def test_a_web_server_traceback_we_have_not_already_logged_reaches_the_stream(log_stream):
    captured = log_stream()

    _relog_as_the_web_server_would(_raised("never seen by our handler"))

    (record,) = captured.tracebacks()
    assert "never seen by our handler" in record["exception"]


def test_the_web_servers_repeat_of_an_exception_we_logged_is_dropped(log_stream):
    captured = log_stream()
    exc = _raised("boom")

    logging.getLogger("app.error").error("Unhandled exception", exc_info=exc)
    mark_traceback_logged(exc)
    _relog_as_the_web_server_would(exc)

    (record,) = captured.tracebacks()
    assert record["logger"] == "app.error"


def test_a_record_never_carries_the_web_servers_ansi_copy_of_the_message(log_stream):
    captured = log_stream()

    logging.getLogger(SERVER_LOGGER).info(
        "Started server process [486539]",
        extra={"color_message": "Started server process [\x1b[36m%d\x1b[0m]"},
    )

    (record,) = captured.records()
    assert "color_message" not in record
    assert "\x1b" not in json.dumps(record)


def test_an_application_record_below_the_configured_level_is_not_written(log_stream):
    captured = log_stream("WARNING")

    logging.getLogger(APP_LOGGER).info("routine")

    assert captured.messages() == []


def test_an_application_record_at_the_configured_level_is_written(log_stream):
    captured = log_stream("DEBUG")

    logging.getLogger(APP_LOGGER).debug("detail")

    assert captured.messages() == ["detail"]


def test_a_logger_with_a_level_of_its_own_cannot_outrank_the_configured_level(log_stream):
    """A library that pins its own logger level must not smuggle records past LOG_LEVEL.

    A logger's level is consulted before root's, so a propagated record never sees
    root's level at all — which is how the web server's loggers used to ignore the
    setting entirely.
    """
    captured = log_stream("WARNING")
    chatty = logging.getLogger("app.tests.logging.chatty")
    chatty.setLevel(logging.DEBUG)
    try:
        chatty.info("noise from a library")
    finally:
        chatty.setLevel(logging.NOTSET)

    assert captured.messages() == []


def test_raising_the_level_hides_the_web_servers_informational_records(log_stream):
    captured = log_stream("ERROR")
    server = logging.getLogger(SERVER_LOGGER)

    server.info("Started server process [486539]")
    server.error("Error loading ASGI app.")

    assert captured.messages() == ["Error loading ASGI app."]


def test_lowering_the_level_reveals_the_web_servers_debug_records(log_stream):
    captured = log_stream("DEBUG")

    logging.getLogger(SERVER_LOGGER).debug("waiting for application startup.")

    assert captured.messages() == ["waiting for application startup."]


@pytest.mark.parametrize("level", ["DEBUG", "INFO", "WARNING", "ERROR"])
def test_the_web_servers_access_record_stays_suppressed_at_every_level(log_stream, level):
    captured = log_stream(level)

    logging.getLogger(SERVER_ACCESS_LOGGER).info('127.0.0.1:0 - "GET /api/health HTTP/1.1" 200')

    assert captured.messages() == []


# --- No credential survives the trip to the stream --------------------------
#
# The app's own call sites don't log secrets, but a dependency's do — so these
# assert on the formatted line, which is the last thing every record passes
# through, rather than on any one field.

_CREDENTIAL_IN_A_URL = "https://store.example/upload?tempauth=eyJ0eXAiOiJKV1QifQ.session"


def test_a_credential_in_the_message_is_redacted_in_the_written_line():
    formatted = _format(_make_record(f"PUT {_CREDENTIAL_IN_A_URL} 202"))

    assert (
        json.loads(formatted)["message"] == "PUT https://store.example/upload?tempauth=REDACTED 202"
    )


def test_a_credential_in_an_extra_field_is_redacted_in_the_written_line():
    formatted = _format(_make_record("stored", store_url=_CREDENTIAL_IN_A_URL))

    assert json.loads(formatted)["store_url"] == "https://store.example/upload?tempauth=REDACTED"


def test_a_credential_in_a_traceback_is_redacted_in_the_written_line():
    try:
        raise RuntimeError(f"could not reach {_CREDENTIAL_IN_A_URL}")
    except RuntimeError as exc:
        record = _make_record("upload failed", level=logging.ERROR)
        record.exc_info = (type(exc), exc, exc.__traceback__)

    assert "eyJ0eXAiOiJKV1QifQ.session" not in _format(record)


# The object store signs every request and can presign a URL. Both spell their
# credentials with hyphens, which the pattern's word boundary cannot reach unless
# the compound name is listed in its own right.
_SIGNATURE = "8ba0b2c1f4e6d7a9c3b5e8f1a2d4c6b8e0f2a4c6d8e0f2a4c6d8e0f2a4c6d8e0"
_ACCESS_KEY_ID = "DO00EXAMPLEACCESSKEYID"
_SECRET_ACCESS_KEY = "Xy7+n0tAr3alSp4c3sS3cr3t/K3y0123456789abcdefgh"
_SCOPE = f"{_ACCESS_KEY_ID}%2F20260904%2Fsyd1%2Fs3%2Faws4_request"


def test_a_presigned_signature_in_a_url_is_redacted_in_the_written_line():
    url = f"https://syd1.digitaloceanspaces.com/bucket/deck.pdf?X-Amz-Signature={_SIGNATURE}"

    formatted = _format(_make_record(f"GET {url} 200"))

    assert _SIGNATURE not in formatted


def test_a_presigned_credential_in_a_url_is_redacted_in_the_written_line():
    url = f"https://syd1.digitaloceanspaces.com/bucket/deck.pdf?X-Amz-Credential={_SCOPE}"

    formatted = _format(_make_record(f"GET {url} 200"))

    assert _ACCESS_KEY_ID not in formatted


def test_a_signing_authorization_header_is_redacted_in_the_written_line():
    """Both values, not just the signature: the credential names the key id."""
    header = (
        f"AWS4-HMAC-SHA256 Credential={_SCOPE}, "
        f"SignedHeaders=host;x-amz-date, Signature={_SIGNATURE}"
    )

    formatted = _format(_make_record("refused", authorization=header))

    assert _SIGNATURE not in formatted
    assert _ACCESS_KEY_ID not in formatted


def test_a_key_pair_assignment_is_redacted_in_the_written_line():
    """The spellings a config dump uses, where the name itself carries a separator."""
    formatted = _format(
        _make_record(f"access_key_id={_ACCESS_KEY_ID} secret_access_key={_SECRET_ACCESS_KEY}")
    )

    assert _ACCESS_KEY_ID not in formatted
    assert _SECRET_ACCESS_KEY not in formatted


def test_a_line_with_no_credential_in_it_is_written_word_for_word():
    formatted = _format(_make_record("Pitch declined", pitch_id="42"))

    assert json.loads(formatted)["message"] == "Pitch declined"


def test_the_http_clients_request_line_stays_suppressed_at_every_level(log_stream):
    """httpx logs the URL it just called at INFO, and the document store's signed
    URLs carry a working credential in the query string."""
    captured = log_stream("DEBUG")

    logging.getLogger("httpx").info("HTTP Request: PUT %s 202", _CREDENTIAL_IN_A_URL)

    assert captured.messages() == []
