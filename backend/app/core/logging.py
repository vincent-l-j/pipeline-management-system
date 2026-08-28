"""Structured JSON logging to stdout."""

import json
import logging
import logging.config
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

from app.core.config import settings

# Set by the request-context middleware; empty outside a request, where there is no id.
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

_STANDARD_RECORD_ATTRS = frozenset(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {
    "message",
    "asctime",
}

# Dropped rather than promoted; see "Logging" in docs/best-practices/backend-fastapi.md.
_NOISE_RECORD_ATTRS = frozenset({"color_message"})


class RequestIdFilter(logging.Filter):
    """Attaches the in-flight request's id to every record that passes through."""

    def filter(self, record: logging.LogRecord) -> bool:
        request_id = request_id_var.get()
        if request_id:
            record.request_id = request_id
        return True


class JsonFormatter(logging.Formatter):
    """Renders a record as one line of JSON."""

    def __init__(self, service: str = "rozetta-pms", environment: str = "development"):
        super().__init__()
        self.service = service
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "service": self.service,
            "environment": self.environment,
            "message": record.getMessage(),
        }

        for key, value in record.__dict__.items():
            if key in _STANDARD_RECORD_ATTRS or key in _NOISE_RECORD_ATTRS or key.startswith("_"):
                continue
            payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        # ensure_ascii stays on: plain ASCII bytes whatever locale the container runs under.
        return json.dumps(payload, default=str)


def setup_logging() -> None:
    """Send every log record to stdout as JSON, including the web server's own."""
    level = settings.LOG_LEVEL.upper()
    logging.config.dictConfig(
        {
            "version": 1,
            # uvicorn ran its own dictConfig before this import; disabling would silence
            # its loggers and pytest's.
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "()": "app.core.logging.JsonFormatter",
                    "environment": settings.ENVIRONMENT,
                }
            },
            "filters": {"request_id": {"()": "app.core.logging.RequestIdFilter"}},
            "handlers": {
                "stdout": {
                    "class": "logging.StreamHandler",
                    "formatter": "json",
                    "stream": sys.stdout,
                    "level": level,
                    # On the handler, not the loggers: a logger's filters are skipped for
                    # records propagating up from its children, missing most of the stream.
                    "filters": ["request_id"],
                }
            },
            "root": {"handlers": ["stdout"], "level": level},
            # `"handlers": []` must be spelled out — dictConfig only clears a logger's
            # handlers when the key is present, and uvicorn's would double every line.
            "loggers": {
                name: {"handlers": [], "propagate": True, "level": logger_level}
                # `uvicorn.access` is muted at every level on purpose; see "Logging" in
                # docs/best-practices/backend-fastapi.md before changing it.
                for name, logger_level in (
                    ("uvicorn", level),
                    ("uvicorn.error", level),
                    ("uvicorn.access", "WARNING"),
                )
            },
        }
    )
