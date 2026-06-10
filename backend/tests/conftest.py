"""Shared test fixtures.

The app normally talks to Postgres; tests run against a shared in-memory SQLite
database instead (StaticPool keeps a single connection so the schema and data
persist across sessions). We force DATABASE_URL to SQLite *before* importing the
app, so the module-level engine and table creation don't try to reach Postgres.
"""
import os

# Must be set before app.core.config / app.core.database are imported.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["ENABLE_DEV_LOGIN"] = "false"

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Base
from app.models.user import User, UserRole

_NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)

# Fixed UUIDs so test users have non-None IDs without needing a DB insert
_ADMIN_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
_ASSESSOR_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000002")
_VIEWER_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000003")

_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSession = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=_engine)


def _get_test_db():
    db = _TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """Unauthenticated client.

    follow_redirects=False is deliberate: a stray 307 (the trailing-slash bug)
    must be visible to the assertions, not silently followed by httpx.
    """
    app.dependency_overrides[get_db] = _get_test_db
    with TestClient(app, follow_redirects=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(client):
    """Client authenticated as an admin (auth dependency overridden)."""
    admin = User(
        id=_ADMIN_ID,
        email="tester@rozettainstitute.com",
        display_name="Tester",
        role=UserRole.ADMIN,
        is_active=True,
        created_at=_NOW,
        updated_at=_NOW,
    )
    app.dependency_overrides[get_current_user] = lambda: admin
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def assessor_client(client):
    """Client authenticated as an assessor."""
    assessor = User(
        id=_ASSESSOR_ID,
        email="assessor@rozettainstitute.com",
        display_name="Assessor",
        role=UserRole.ASSESSOR,
        is_active=True,
        created_at=_NOW,
        updated_at=_NOW,
    )
    app.dependency_overrides[get_current_user] = lambda: assessor
    yield client
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_client(client):
    """Client authenticated as a viewer (read-only role)."""
    viewer = User(
        id=_VIEWER_ID,
        email="viewer@rozettainstitute.com",
        display_name="Viewer",
        role=UserRole.VIEWER,
        is_active=True,
        created_at=_NOW,
        updated_at=_NOW,
    )
    app.dependency_overrides[get_current_user] = lambda: viewer
    yield client
    app.dependency_overrides.pop(get_current_user, None)
