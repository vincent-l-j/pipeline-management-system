"""Organisation CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.organisation import Organisation
from app.schemas.organisation import OrganisationCreate, OrganisationUpdate, OrganisationOut

router = APIRouter(prefix="/organisations", tags=["organisations"])


@router.get("", response_model=list[OrganisationOut])
def list_organisations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Organisation).order_by(Organisation.name).all()


@router.get("/{org_id}", response_model=OrganisationOut)
def get_organisation(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return org


@router.post("", response_model=OrganisationOut)
def create_organisation(
    data: OrganisationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    org = Organisation(**data.model_dump())
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.patch("/{org_id}", response_model=OrganisationOut)
def update_organisation(
    org_id: UUID,
    data: OrganisationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return org


@router.delete("/{org_id}")
def delete_organisation(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    db.delete(org)
    db.commit()
    return {"detail": "Organisation deleted"}
