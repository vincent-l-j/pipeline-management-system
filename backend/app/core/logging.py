"""Structured JSON logging to stdout."""

import json
import logging
import logging.config
import sys
from datetime import UTC, datetime
from typing import Any

from app.core.config import settings

_STANDARD_RECORD_ATTRS = frozenset(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {
    "message",
    "asctime",
}

# Dropped rather than promoted; see "Logging" in docs/best-practices/backend-fastapi.md.
_NOISE_RECORD_ATTRS = frozenset({"color_message"})


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
            "handlers": {
                "stdout": {
                    "class": "logging.StreamHandler",
                    "formatter": "json",
                    "stream": sys.stdout,
                    "level": level,
                }
            },
            "root": {"handlers": ["stdout"], "level": level},
            # `"handlers": []` must be spelled out — dictConfig only clears a logger's
            # handlers when the key is present, and uvicorn's would double every line.
            "loggers": {
                name: {"handlers": [], "propagate": True, "level": level}
                for name in ("uvicorn", "uvicorn.error", "uvicorn.access")
            },
        }
    )
