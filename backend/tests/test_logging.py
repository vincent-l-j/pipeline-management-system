"""Log records are single-line JSON on stdout, and the web server's loggers share it."""

import io
import json
import logging
import uuid

import pytest

from app.core.logging import JsonFormatter, setup_logging


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


def test_a_web_server_record_is_written_once_and_as_json(log_stream):
    captured = log_stream()

    logging.getLogger(SERVER_LOGGER).info("Started server process [%d]", 486539)

    assert captured.messages() == ["Started server process [486539]"]


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
