# Backend best practices — FastAPI + Python + unit tests

Conventions for `backend/` in this repo. Examples are drawn from the existing
code; match them rather than introducing new patterns.

## Layout

```
backend/app/
├── api/routes/   one router per resource (pitches.py, contacts.py, …)
├── core/         config.py, database.py, security.py
├── models/       SQLAlchemy models (one file per aggregate)
├── schemas/      Pydantic request/response models
├── services/     cross-cutting logic (ai_notetaker.py)
└── main.py       app factory: middleware + router registration
```

Keep HTTP concerns in `routes/`, persistence in `models/`, serialization in
`schemas/`, and reusable logic in `services/`. Routes should stay thin.

## Routing

- **One `APIRouter` per resource**, `prefix="/resource"`, registered in
  `main.py` with `prefix="/api"`. The public path is therefore `/api/resource`.
- **No trailing slashes.** `app.router.redirect_slashes = False` is set and there
  is a regression test (`tests/test_no_trailing_slash.py`). Declare collection
  routes as `@router.get("")`, not `@router.get("/")`.
- Always set `response_model=` so the response shape is an explicit `*Out`
  schema, never a raw ORM object.
- Type path params (`pitch_id: UUID`) so FastAPI validates and coerces them.
- Return the object for `200`; raise `HTTPException` for errors.

```python
router = APIRouter(prefix="/pitches", tags=["pitches"])

@router.get("", response_model=list[PitchOut])
def list_pitches(db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    return db.query(Pitch).order_by(Pitch.created_at.desc()).all()

@router.get("/{pitch_id}", response_model=PitchOut)
def get_pitch(pitch_id: UUID, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch
```

## Dependencies (auth & DB)

- `Depends(get_db)` — one `Session` per request; it is closed automatically.
- `Depends(get_current_user)` — requires a valid JWT; loads the user **from the
  DB** and checks `is_active`, so demotions/deactivations take effect immediately.
- `Depends(require_role(UserRole.ADMIN, ...))` — authorization. **Every mutating
  or privileged endpoint must gate on a role.** The frontend is never the
  security boundary; if a route isn't protected here, it isn't protected.

```python
@router.delete("/{org_id}")
def delete_organisation(org_id: UUID, db: Session = Depends(get_db),
                        current_user: User = Depends(require_role(UserRole.ADMIN))):
    ...
```

## Schemas (Pydantic v2)

- Three per resource: `*Create`, `*Update`, `*Out`.
- `*Out` sets `model_config = {"from_attributes": True}` to read from ORM objects.
- **`*Update` fields are optional**, applied with `model_dump(exclude_unset=True)`
  so a PATCH touches only supplied fields.
- Schemas are **explicit allowlists** — Pydantic drops unknown fields, which is
  what protects against mass-assignment. Do **not** widen a schema just to let a
  field through; if a field must not be client-settable (e.g. `current_stage` on
  `PitchUpdate`), keep it out of the schema entirely.
- Use `EmailStr` for emails.

```python
class ContactUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    organisation_id: UUID | None = None

# in the route:
for field, value in data.model_dump(exclude_unset=True).items():
    setattr(contact, field, value)
```

- **Least-privilege responses.** An `*Out` should expose only what the caller
  needs. Where a low-privilege caller needs a subset (e.g. names without emails),
  add a dedicated narrow schema rather than reusing the full one — this is the
  intent behind the planned user directory (a minimal `id`/`display_name` schema
  distinct from the admin-only `UserOut`; see `features.json`).

## Models (SQLAlchemy 2.0)

- Typed style: `Mapped[...]` + `mapped_column(...)`.
- UUID primary keys: `mapped_column(primary_key=True, default=uuid.uuid4)`.
- Inherit `TimestampMixin` for `created_at` / `updated_at`.
- Enumerated columns use `str`-based `enum.Enum` + `SAEnum(...)`.
- Declare relationships with explicit `back_populates`. Choose delete behaviour
  deliberately: `cascade="all, delete-orphan"` for owned children (e.g. a pitch's
  stage history), and **handle FK-nulling or link-row deletion in the route/service**
  for cross-aggregate references — do not rely on DB `ondelete`, because unit
  tests run on SQLite with FK enforcement off (see the integration doc).

## Errors

- `404` not found, `403` wrong role, `400` conflict/bad state, `422` is automatic
  from schema validation. Keep `detail` messages short and human-readable.

## Config

- All settings via `app/core/config.py` (`pydantic-settings`), read from env / `.env`.
- Secrets (`SECRET_KEY`, Azure, `ANTHROPIC_API_KEY`) come from the environment —
  never hardcode or commit them. Defaults in `config.py` are dev-only placeholders.

## Unit tests (pytest + TestClient)

- Location: `backend/tests/`, one module per resource. Test-only deps go in
  `requirements-dev.txt`.
- Tests run against **in-memory SQLite** — `conftest.py` sets `DATABASE_URL=sqlite://`
  *before* importing the app, and overrides `get_db`. No Postgres needed.
- Use the ready-made fixtures instead of building auth: `client` (unauthenticated),
  `admin_client`, `assessor_client`, `viewer_client`. They override
  `get_current_user`, so you test authorization logic without minting JWTs.
- `follow_redirects=False` is deliberate — a stray `307` (trailing-slash bug) must
  surface as a failure, not be silently followed.

**Write tests first (TDD).** For each endpoint cover the happy path, each role
boundary, and the not-found case:

```python
def test_admin_can_delete_org(admin_client):
    org = admin_client.post("/api/organisations", json={"name": "X"}).json()
    assert admin_client.delete(f"/api/organisations/{org['id']}").status_code == 200
    assert admin_client.get(f"/api/organisations/{org['id']}").status_code == 404

def test_viewer_cannot_delete_org(viewer_client):
    assert viewer_client.delete(
        "/api/organisations/00000000-0000-0000-0000-000000000000"
    ).status_code == 403
```

Guidelines:
- One behaviour per test; name it for the behaviour (`test_<subject>_<expectation>`).
- Assert **status code first**, then body.
- Cover RBAC explicitly: `200`/`201` for allowed roles, `403` for disallowed, `401`
  unauthenticated. These are the assertions the validation contract leans on.
- For data-integrity features (orphan/cascade), assert the *side effects*: the
  child survives with a nulled FK, or the join row is gone.

## Checklist before handoff

- [ ] Route has `response_model` and no trailing slash.
- [ ] Privileged actions gate on `require_role`.
- [ ] `*Update` excludes fields that must not be client-settable.
- [ ] Tests cover happy path + every role + 404, and pass via `cd backend && pytest`.
