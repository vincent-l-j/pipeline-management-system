"""Development-only authentication routes.

This module is deliberately NOT present in production images — the `prod` stage
of backend/Dockerfile deletes it. It is imported only when ENABLE_DEV_LOGIN is
true (see app/main.py), so the admin-minting bypass cannot exist in a production
artifact: the code simply isn't there to exploit.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import User, UserRole

router = APIRouter(prefix="/auth", tags=["auth-dev"])


@router.get("/dev-token")
def dev_token(db: Session = Depends(get_db)):
    """Create (or reuse) a test admin user and return a JWT — no Microsoft needed."""
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
