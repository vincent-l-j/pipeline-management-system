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
# config.py has no defaults for these secrets (a missing secret must crash prod,
# not run on a guessable key); give the test app throwaway values to boot with.
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("AZURE_CLIENT_SECRET", "test-azure-client-secret")

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
def db_session():
    """A direct DB session for arranging/asserting on rows the API doesn't expose
    (e.g. PitchContact join rows). Shares the in-memory engine with the app."""
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


class _AuthenticatedTestClient:
    """Wrapper around TestClient that manages authentication per request."""
    def __init__(self, user):
        self.user = user
        app.dependency_overrides[get_db] = _get_test_db
        self.client = TestClient(app, follow_redirects=False)

    def _make_request(self, method, *args, **kwargs):
        # Set up the override just before making the request
        app.dependency_overrides[get_current_user] = lambda: self.user
        try:
            return method(*args, **kwargs)
        finally:
            # Clean up after the request
            app.dependency_overrides.pop(get_current_user, None)

    def get(self, *args, **kwargs):
        return self._make_request(self.client.get, *args, **kwargs)

    def post(self, *args, **kwargs):
        return self._make_request(self.client.post, *args, **kwargs)

    def patch(self, *args, **kwargs):
        return self._make_request(self.client.patch, *args, **kwargs)

    def delete(self, *args, **kwargs):
        return self._make_request(self.client.delete, *args, **kwargs)

    def put(self, *args, **kwargs):
        return self._make_request(self.client.put, *args, **kwargs)

    def head(self, *args, **kwargs):
        return self._make_request(self.client.head, *args, **kwargs)

    def options(self, *args, **kwargs):
        return self._make_request(self.client.options, *args, **kwargs)


@pytest.fixture
def admin_client():
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
    client = _AuthenticatedTestClient(admin)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def assessor_client():
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
    client = _AuthenticatedTestClient(assessor)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def viewer_client():
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
    client = _AuthenticatedTestClient(viewer)
    yield client
    app.dependency_overrides.clear()
