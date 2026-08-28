"""Per-request correlation: an id on every response, and one access record per request."""

import logging
import re
import time
import uuid
from typing import Any

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import request_id_var

REQUEST_ID_HEADER = "X-Request-ID"

# Caller-controlled, and echoed into both the response and the log stream — anything
# not matching this shape is replaced, keeping forged headers and log records out.
_SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

# Successful probes are demoted to DEBUG, not dropped, so they stay available.
_HEALTH_PATHS = frozenset({"/api/health", "/api/health/ready"})

logger = logging.getLogger("app.access")


def _resolve_request_id(request: Request) -> str:
    inbound = request.headers.get(REQUEST_ID_HEADER, "")
    if _SAFE_REQUEST_ID.fullmatch(inbound):
        return inbound
    return uuid.uuid4().hex


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns the request id, echoes it, and writes the request's access record."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = _resolve_request_id(request)
        token = request_id_var.set(request_id)
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            self._record(request, status_code=500, started=started)
            request_id_var.reset(token)
            raise
        response.headers[REQUEST_ID_HEADER] = request_id
        self._record(request, status_code=response.status_code, started=started)
        request_id_var.reset(token)
        return response

    def _record(self, request: Request, *, status_code: int, started: float) -> None:
        fields: dict[str, Any] = {
            "event": "http_request",
            "method": request.method,
            # The path only — a query string carries user data.
            "path": request.url.path,
            "status_code": status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000, 3),
            "user_id": getattr(request.state, "user_id", None),
            "user_role": getattr(request.state, "user_role", None),
        }
        is_quiet_probe = request.url.path in _HEALTH_PATHS and status_code < 400
        logger.log(
            logging.DEBUG if is_quiet_probe else logging.INFO,
            "Request handled",
            extra={key: value for key, value in fields.items() if value is not None},
        )


def install_request_context(app: FastAPI) -> None:
    """Wire the middleware onto an app.

    A function rather than an `@app.middleware("http")` decorator in `main.py`, so
    tests can install it on a throwaway app instead of mutating the shared one.
    """
    app.add_middleware(RequestContextMiddleware)
