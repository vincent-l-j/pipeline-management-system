"""Per-request correlation: an id on every response, one access record per request,
and a quotable id on the generic 500 an unhandled failure returns."""

import logging
import re
import time
import uuid
from typing import Any

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.logging import mark_traceback_logged, request_id_var

REQUEST_ID_HEADER = "X-Request-ID"

# Caller-controlled, and echoed into both the response and the log stream — anything
# not matching this shape is replaced, keeping forged headers and log records out.
_SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

# Successful probes are demoted to DEBUG, not dropped, so they stay available.
_HEALTH_PATHS = frozenset({"/api/health", "/api/health/ready"})

logger = logging.getLogger("app.access")
error_logger = logging.getLogger("app.error")


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


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Answer an unexpected failure with a generic 500 the caller can quote back.

    The message, the traceback and anything else the exception knows stay in the
    log; the caller gets only the id that locates that record.
    """
    # `request.state` first: the middleware has already reset the ContextVar by now.
    request_id = getattr(request.state, "request_id", "") or request_id_var.get()

    error_logger.exception(
        "Unhandled exception",
        extra={
            "event": "unhandled_exception",
            "method": request.method,
            "path": request.url.path,
            "request_id": request_id,
        },
    )
    # Stamped only after our record is out, so DuplicateTracebackFilter drops uvicorn's.
    mark_traceback_logged(exc)

    # Set here, not by the middleware: ServerErrorMiddleware sits outside it, so this
    # response never passes back through.
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
        headers={REQUEST_ID_HEADER: request_id},
    )


def install_request_context(app: FastAPI) -> None:
    """Wire the middleware and the unhandled-exception handler onto an app.

    A function rather than an `@app.middleware("http")` decorator in `main.py`, so
    tests can install it on a throwaway app instead of mutating the shared one.
    """
    app.add_middleware(RequestContextMiddleware)
    # Doesn't intercept `HTTPException` — ordinary error bodies keep their shape.
    app.add_exception_handler(Exception, unhandled_exception_handler)
