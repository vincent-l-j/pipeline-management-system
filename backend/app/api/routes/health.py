"""Liveness and readiness probes."""

import logging

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.health import LivenessOut, ReadinessOut

router = APIRouter(prefix="/health", tags=["health"])

logger = logging.getLogger(__name__)


@router.get("", response_model=LivenessOut)
def liveness() -> LivenessOut:
    """Report that the process is up, deliberately without touching the database.

    A failure here restarts the instance, so dependency checks belong in readiness;
    see "Production" in docs/architecture.md.
    """
    return LivenessOut(status="ok", app="Rozetta PMS")


@router.get(
    "/ready",
    response_model=ReadinessOut,
    responses={503: {"model": ReadinessOut}},
)
def readiness(response: Response, db: Session = Depends(get_db)) -> ReadinessOut:
    """Report whether the app can serve traffic, checking the database it depends on."""
    database = "ok"
    try:
        # SessionLocal() is lazy, so a dead database surfaces here on execute
        # rather than while the dependency is being resolved.
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        # Type and message, not `logger.exception` — a traceback per poll buries the outage.
        logger.error(
            "Readiness probe could not reach the database",
            extra={
                "event": "readiness_check_failed",
                "error_type": type(exc).__name__,
                "error_message": str(exc),
            },
        )
        database = "unreachable"
        # Injected Response, not HTTPException, so the body survives; the documented
        # probe-only exception in "Errors", docs/best-practices/backend-fastapi.md.
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadinessOut(
        status="ok" if database == "ok" else "unavailable",
        database=database,
        version=settings.APP_VERSION,
    )
