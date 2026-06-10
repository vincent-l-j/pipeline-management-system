"""Rozetta PMS — FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.models import Base
from app.api.routes import auth, users, organisations, contacts, pitches, meetings, assessments, search, timeline, reports

# Create all database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Rozetta PMS",
    description="Pipeline Management System for Rozetta Institute",
    version="0.1.0",
    # Don't auto-redirect /path <-> /path/. A trailing-slash mismatch now fails
    # loudly with a 404 instead of a silent 307 — the latter masked a real bug
    # where the redirect pointed at an unreachable host behind the dev proxy.
    redirect_slashes=False,
)

# Allow the frontend to talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Dev-only login routes live in an optional module that is stripped from
# production images. We import it only when explicitly enabled, so enabling the
# flag on a production build (where the module was removed) is a safe no-op.
if settings.ENABLE_DEV_LOGIN:
    try:
        from app.api.routes import dev
        app.include_router(dev.router, prefix="/api")
    except ImportError:
        import logging
        logging.getLogger("uvicorn.error").warning(
            "ENABLE_DEV_LOGIN is set, but dev routes are not present in this build — ignoring."
        )


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Rozetta PMS"}
