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
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None

# in the route:
for field, value in data.model_dump(exclude_unset=True).items():
    setattr(contact, field, value)
```

- **Least-privilege responses.** An `*Out` should expose only what the caller
  needs. Where a low-privilege caller needs a subset (e.g. names without emails),
  add a dedicated narrow schema rather than reusing the full one — this is the
  intent behind the user directory (`UserDirectoryOut`, a minimal `id`/`display_name`
  schema distinct from the admin-only `UserOut`, served by `GET /users/directory`).

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
  _before_ importing the app, and overrides `get_db`. No Postgres needed.
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
```

Guidelines:

- **One behaviour per test; name it for the behaviour** (`test_<subject>_<expectation>`).
  This applies SRP to tests — each test should have one reason to fail. Don't
  combine multiple roles or states into a single test.
- Assert **status code first**, then body.
- **Cover each role as its own case.** One case per (role, operation) — never one
  test that loops over roles internally, because the first failure hides the rest.
  Where the cells differ only in data, express them as a `parametrize` grid rather
  than as copy-pasted functions: pytest still reports one case per cell
  (`test_contact_rbac[viewer-create-403]`), so a broken role is named in the
  output, and a missing cell is visible as a hole in the table instead of an
  absent function nobody notices. `request.getfixturevalue(f"{role}_client")`
  selects the client fixture from the parametrised role.

```python
@pytest.mark.parametrize(
    ("role", "operation", "expected"),
    [
        ("assessor", "list", ALLOWED),
        ("assessor", "create", ALLOWED),
        ("assessor", "delete", DENIED),
        ("viewer", "list", ALLOWED),
        ("viewer", "create", DENIED),
        ("viewer", "delete", DENIED),
    ],
)
def test_organisation_rbac(request, role, operation, expected):
    client = request.getfixturevalue(f"{role}_client")
    assert ORGANISATION_OPERATIONS[operation](client).status_code == expected
```

- Keep a case out of the grid when it asserts more than a status — the tests that
  check a response body or that a rejected write left the row untouched stay as
  their own named functions.
- **Shared literals live in `tests/constants.py`**, not re-declared per module:
  `UNKNOWN_ID`, a syntactically valid UUID that must never resolve, plus `ALLOWED`
  and `DENIED` for the RBAC grids above. Endpoint paths and status codes otherwise
  stay inline — the path is the thing under test, and naming `200` in an ordinary
  assertion only adds indirection. `ALLOWED`/`DENIED` earn their names because in a
  grid that column answers "may this role?", not "what status?"; they are not
  general aliases, so a grid whose success is not `200` spells the code out.
- **Assert the exact status; never a set of acceptable ones.** The two ways to
  fail authentication are distinct and both deterministic: a _missing_
  Authorization header is refused by `HTTPBearer(auto_error=True)` with **403**
  before our code runs, while a header carrying a bad token reaches
  `get_current_user` and raises **401**. Test them as separate cases
  (`tests/test_auth.py`). An `in (401, 403)` assertion passes whichever way the
  request failed, so it cannot show that the request was rejected for the reason
  the test claims.
- For data-integrity features (orphan/cascade), assert the _side effects_: the
  child survives with a nulled FK, or the join row is gone.

## Checklist before handoff

- [ ] Route has `response_model` and no trailing slash.
- [ ] Privileged actions gate on `require_role`.
- [ ] `*Update` excludes fields that must not be client-settable.
- [ ] Tests cover happy path + every role + 404, and pass via `cd backend && pytest`.
