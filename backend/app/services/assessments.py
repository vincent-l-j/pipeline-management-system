"""Resolving a pitch's current assessment.

Assessments are immutable-with-versions: amending one appends a row at
version + 1 rather than mutating the old one. So "the assessment for this pitch"
always means "the highest-versioned one", and more than one caller needs it.

Kept deliberately free of window functions: the unit suite runs on SQLite and the
app on Postgres, and `GROUP BY` with a self-join behaves identically on both.
"""

from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.assessment import Assessment


def latest_version_subquery(db: Session):
    """(pitch_id, max_version) for every pitch that has an assessment."""
    return (
        db.query(Assessment.pitch_id, func.max(Assessment.version).label("max_version"))
        .group_by(Assessment.pitch_id)
        .subquery()
    )


def latest_assessments_query(db: Session):
    """Each pitch's highest-versioned assessment, one row per pitch."""
    subquery = latest_version_subquery(db)
    return db.query(Assessment).join(
        subquery,
        (Assessment.pitch_id == subquery.c.pitch_id)
        & (Assessment.version == subquery.c.max_version),
    )


def latest_assessment_by_pitch(db: Session) -> dict[UUID, Assessment]:
    """Every pitch's latest assessment, keyed by pitch id, in one query.

    This is what keeps the pitch list off an N+1: the list route resolves the
    whole page's decline reasons with one extra statement rather than one per row.
    """
    return {assessment.pitch_id: assessment for assessment in latest_assessments_query(db).all()}
