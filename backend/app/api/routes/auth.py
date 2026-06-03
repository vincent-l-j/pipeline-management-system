"""Microsoft Azure AD OAuth authentication routes.

Flow:
1. Frontend redirects user to /api/auth/login
2. User signs in with Microsoft
3. Microsoft redirects back to /api/auth/callback
4. We validate the token, find or create the user, and issue a JWT
5. Frontend stores the JWT and sends it with every request
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import msal

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import User, UserRole

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_msal_app():
    return msal.ConfidentialClientApplication(
        settings.AZURE_CLIENT_ID,
        authority=settings.azure_authority_url,
        client_credential=settings.AZURE_CLIENT_SECRET,
    )


@router.get("/login")
def login():
    """Start the Microsoft OAuth login flow."""
    app = _build_msal_app()
    auth_url = app.get_authorization_request_url(
        scopes=["User.Read"],
        redirect_uri=settings.AZURE_REDIRECT_URI,
    )
    return RedirectResponse(auth_url)


@router.get("/callback")
def callback(code: str, db: Session = Depends(get_db)):
    """Handle the redirect back from Microsoft after login."""
    app = _build_msal_app()
    result = app.acquire_token_by_authorization_code(
        code,
        scopes=["User.Read"],
        redirect_uri=settings.AZURE_REDIRECT_URI,
    )

    if "error" in result:
        raise HTTPException(status_code=401, detail=result.get("error_description", "Auth failed"))

    # Extract user info from the ID token claims
    claims = result.get("id_token_claims", {})
    email = claims.get("preferred_username", "").lower()
    name = claims.get("name", email)
    oid = claims.get("oid")

    # Restrict to Rozetta domain
    if not email.endswith("@rozettainstitute.com"):
        raise HTTPException(status_code=403, detail="Access restricted to @rozettainstitute.com accounts")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Bootstrap admins from config so the first real sign-in isn't stuck as VIEWER
        admin_emails = {e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()}
        role = UserRole.ADMIN if email in admin_emails else UserRole.VIEWER
        user = User(
            email=email,
            display_name=name,
            azure_oid=oid,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif oid and not user.azure_oid:
        user.azure_oid = oid
        db.commit()

    # Issue our own JWT
    token = create_access_token(str(user.id), user.email, user.role.value)

    # Redirect to frontend with the token
    return RedirectResponse(f"http://localhost:5173/auth/callback?token={token}")


@router.get("/dev-token")
def dev_token(db: Session = Depends(get_db)):
    """Development only — creates a test admin user and returns a JWT.
    Remove this endpoint before production deployment."""
    email = "dev@rozettainstitute.com"
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            display_name="Dev Admin",
            role=UserRole.ADMIN,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(str(user.id), user.email, user.role.value)
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role.value,
    }}
