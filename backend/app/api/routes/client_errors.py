"""Intake for browser error reports, so a render failure reaches the same log stream."""

import logging

from fastapi import APIRouter, Depends, Request, status

from app.core.logging import request_id_var
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.client_error import ClientErrorAck, ClientErrorReport

router = APIRouter(prefix="/client-errors", tags=["client-errors"])

logger = logging.getLogger("app.client_errors")


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=ClientErrorAck)
def report_client_error(
    report: ClientErrorReport,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> ClientErrorAck:
    """Record a browser failure in the backend log stream.

    Authenticated but role-free: a render error happens to whoever is on the page, and
    this writes into the operator's log with no rate limiter in front of it.
    """
    request_id = getattr(request.state, "request_id", "") or request_id_var.get()

    # Caller data goes in `extra=` and every key is prefixed — both load-bearing; see the
    # worked example under "Logging" in docs/best-practices/backend-fastapi.md.
    logger.error(
        "Client error reported",
        extra={
            "event": "client_error",
            "client_message": report.message,
            "client_url": report.url,
            "client_stack": report.stack,
            "client_component_stack": report.component_stack,
            "client_correlated_request_id": report.correlated_request_id,
            # From the credential, never the body.
            "user_id": str(current_user.id),
            "user_role": current_user.role.value,
        },
    )

    return ClientErrorAck(request_id=request_id)
