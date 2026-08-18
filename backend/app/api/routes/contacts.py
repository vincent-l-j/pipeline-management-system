"""Contact CRUD routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.contact import Contact, ContactOrganisation
from app.models.meeting import MeetingAttendee
from app.models.organisation import Organisation
from app.models.pitch import PitchContact
from app.models.user import User, UserRole
from app.schemas.contact import ContactCreate, ContactOut, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])

_BLANK_CONTACT_DETAIL = "A contact needs at least one detail recorded"


def _set_organisations(contact: Contact, organisation_ids: list[UUID], db: Session) -> None:
    """Replace a contact's affiliations with the given organisations.

    Duplicates collapse — the same organisation twice is one affiliation. The set
    is unordered; callers that display it should sort by whatever they show.
    """
    wanted = list(dict.fromkeys(organisation_ids))
    if wanted:
        known = {
            org_id
            for (org_id,) in db.query(Organisation.id).filter(Organisation.id.in_(wanted)).all()
        }
        missing = [org_id for org_id in wanted if org_id not in known]
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown organisation: {', '.join(str(org_id) for org_id in missing)}",
            )

    # Assigning through the relationship (rather than deleting rows by query) lets
    # delete-orphan clear the old links and keeps the in-memory contact consistent,
    # which the is_blank check that follows relies on.
    contact.organisation_links = [ContactOrganisation(organisation_id=org_id) for org_id in wanted]


@router.get("", response_model=list[ContactOut])
def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Eager-loaded: ContactOut reads organisation_ids off every row, which would
    # otherwise be one query per contact.
    return (
        db.query(Contact)
        .options(selectinload(Contact.organisation_links))
        .order_by(Contact.first_name, Contact.last_name)
        .all()
    )


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(
    contact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.post("", response_model=ContactOut)
def create_contact(
    data: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    fields = data.model_dump()
    organisation_ids = fields.pop("organisation_ids")
    contact = Contact(**fields)
    _set_organisations(contact, organisation_ids, db)
    if contact.is_blank:
        raise HTTPException(status_code=422, detail=_BLANK_CONTACT_DETAIL)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: UUID,
    data: ContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ASSESSOR)),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    fields = data.model_dump(exclude_unset=True)
    organisation_ids = fields.pop("organisation_ids", None)
    for field, value in fields.items():
        setattr(contact, field, value)
    if organisation_ids is not None:
        try:
            _set_organisations(contact, organisation_ids, db)
        except HTTPException:
            db.rollback()
            raise
    if contact.is_blank:
        db.rollback()
        raise HTTPException(status_code=422, detail=_BLANK_CONTACT_DETAIL)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}")
def delete_contact(
    contact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Remove join rows in the same transaction so no dangling references remain
    # (enforced in app code, not via DB cascade — SQLite tests don't enforce FKs).
    db.query(ContactOrganisation).filter(ContactOrganisation.contact_id == contact_id).delete(
        synchronize_session=False
    )
    db.query(PitchContact).filter(PitchContact.contact_id == contact_id).delete(
        synchronize_session=False
    )
    db.query(MeetingAttendee).filter(MeetingAttendee.contact_id == contact_id).delete(
        synchronize_session=False
    )
    db.delete(contact)
    db.commit()
    return {"detail": "Contact deleted"}
