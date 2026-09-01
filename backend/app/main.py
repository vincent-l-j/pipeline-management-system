"""Rozetta PMS — FastAPI application entry point."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    assessments,
    auth,
    client_errors,
    contacts,
    health,
    meetings,
    organisations,
    pitches,
    reports,
    search,
    timeline,
    users,
)
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.request_context import REQUEST_ID_HEADER, install_request_context

setup_logging()

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Rozetta PMS",
    description="Pipeline Management System for Rozetta Institute",
    version="0.1.0",
)

app.router.redirect_slashes = False

# Allow the frontend to talk to the backend. expose_headers is required for the SPA
# to read the request id — a browser hides any header the server does not list.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[REQUEST_ID_HEADER],
)

# Must stay registered after CORS to end up outside it; see "Request correlation" in
# docs/best-practices/backend-fastapi.md. Don't reorder.
install_request_context(app)

# Register all route groups
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(organisations.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(pitches.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")
app.include_router(assessments.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(timeline.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(client_errors.router, prefix="/api")

# Dev-only login routes live in an optional module that is stripped from
# production images. We import it only when explicitly enabled, so enabling the
# flag on a production build (where the module was removed) is a safe no-op.
if settings.ENABLE_DEV_LOGIN:
    try:
        from app.api.routes import dev

        app.include_router(dev.router, prefix="/api")
    except ImportError:
        logger.warning(
            "ENABLE_DEV_LOGIN is set, but dev routes are not present in this build — ignoring."
        )
