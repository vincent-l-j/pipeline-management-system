"""Application-wide wiring: request correlation reaches real responses and records."""

import logging
import uuid

import pytest

from app.core.request_context import REQUEST_ID_HEADER
from app.core.security import create_access_token
from app.models.user import User, UserRole
from tests.constants import UNKNOWN_ID

ACCESS_LOGGER = "app.access"

# The three expected errors the app answers with, each produced by a real request
# to a real route rather than a throwaway app: the shape under test is the one a
# caller actually receives. Keyed by status so a failing cell names itself.
ORDINARY_ERRORS = {
    404: ("admin_client", lambda c: c.get(f"/api/organisations/{UNKNOWN_ID}")),
    403: ("viewer_client", lambda c: c.post("/api/organisations", json={"name": "Denied Org"})),
    422: ("admin_client", lambda c: c.post("/api/organisations", json={})),
}


@pytest.fixture
def access_records(caplog):
    caplog.set_level(logging.INFO, logger=ACCESS_LOGGER)
    yield lambda: [record for record in caplog.records if record.name == ACCESS_LOGGER]


def test_response_carries_a_request_id_header(client):
    response = client.get("/api/health")

    assert response.headers[REQUEST_ID_HEADER]


def test_the_request_id_header_is_exposed_to_cross_origin_callers(client):
    response = client.get("/api/health", headers={"Origin": "http://localhost:5173"})

    exposed = response.headers["access-control-expose-headers"].lower()
    assert REQUEST_ID_HEADER.lower() in exposed


def test_the_access_record_identifies_the_authenticated_user(client, db_session, access_records):
    # A real row and a real token, because the authenticated client fixtures
    # override the auth dependency and so never run the code being tested.
    user = User(
        id=uuid.uuid4(),
        email=f"correlated-{uuid.uuid4().hex}@rozettainstitute.com",
        display_name="Correlated",
        role=UserRole.ASSESSOR,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    token = create_access_token(str(user.id), user.email, user.role.value)

    response = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    (record,) = access_records()
    assert record.user_id == str(user.id)
    assert record.user_role == "assessor"


def test_the_access_record_for_an_anonymous_request_omits_the_user(client, access_records):
    client.get("/api/users/me")

    (record,) = access_records()
    assert not hasattr(record, "user_id")
    assert not hasattr(record, "user_role")


@pytest.mark.parametrize("status", list(ORDINARY_ERRORS))
def test_a_client_error_response_carries_a_request_id_header(request, status):
    """Every response, not only the successful one.

    A client error is the case a caller is most likely to be quoting back, so the
    header has to reach it too — the middleware sets it on the way out regardless
    of what the route decided.
    """
    fixture, send = ORDINARY_ERRORS[status]

    response = send(request.getfixturevalue(fixture))

    assert response.status_code == status
    assert response.headers[REQUEST_ID_HEADER] != ""
