# Backend best practices — FastAPI + Python + unit tests

Conventions for `backend/` in this repo. Examples are drawn from the existing
code; match them rather than introducing new patterns.

## Layout

```
backend/app/
├── api/routes/   one router per resource (pitches.py, contacts.py, …)
├── core/         config.py, database.py, logging.py, request_context.py, security.py
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
- **Anything unhandled becomes a generic 500 with a quotable id.** The handler in
  `app/core/request_context.py` (wired by `install_request_context`) answers with
  `500 {"detail": "Internal server error", "request_id": "..."}`, repeats the id in
  the `X-Request-ID` header, and logs the exception with its traceback and that id —
  exactly once; see **One traceback per failure** under Logging for why the web
  server's uncorrelated second copy is filtered out.
  The body deliberately carries no exception message, stack frame, SQL or file path —
  the caller quotes the id, and the log holds the detail.
- **`HTTPException` responses are unchanged by that handler**, and must stay that
  way: a `404`/`403`/`400` still returns exactly `{"detail": ...}` with no
  `request_id`, because the frontend's `src/services/apiError.ts` parses that shape.
  Registering a handler for `Exception` doesn't intercept `HTTPException`; there is a
  regression test pinning it.
- The handler sets the header on the response itself rather than relying on the
  middleware. Starlette's `ServerErrorMiddleware` sits _outside_ all user middleware,
  so a 500 built there never passes back out through `RequestContextMiddleware` — and
  for the same reason it bypasses `CORSMiddleware`, so a **cross-origin** 500 arrives
  without CORS headers. Harmless here: production is same-origin behind the platform
  ingress, and development goes through the Vite proxy.

## Config

- All settings via `app/core/config.py` (`pydantic-settings`), read from env / `.env`.
- Secrets (`SECRET_KEY`, Azure, `ANTHROPIC_API_KEY`) come from the environment —
  never hardcode or commit them. Defaults in `config.py` are dev-only placeholders.

## Logging

`app/core/logging.py` configures the whole process: `setup_logging()` runs in
`main.py` before the app is built, and every record — the app's and uvicorn's
startup and shutdown lines — is written to **stdout as one line of JSON**.
`LOG_LEVEL` and `ENVIRONMENT` come from `Settings`.

**What `LOG_LEVEL` affects.** It is applied in three places, and the asymmetry
below is deliberate:

- the **root logger**, so every application record obeys it;
- the **stdout handler**, so a library that pins its own logger level cannot
  smuggle records past it — a logger's level is consulted before root's, so a
  propagating record never sees root's level at all;
- **uvicorn's `uvicorn` and `uvicorn.error` loggers**, so raising the level
  quietens the server's startup chatter and lowering it reaches its debug records.
  They used to be pinned at `INFO`, which made the setting look broken from outside.

**`uvicorn.access` is the exception: it stays muted at `WARNING` at every level**,
including `DEBUG`. It only ever logs at `INFO`, so `WARNING` silences its built-in
line without disabling the logger, and the point of doing that is to stop the
platform's ten-second liveness probe burying the stream. Our middleware emits the
access record instead — and at `DEBUG` the probes reappear _there_, which is the
supported way to see them. The env var is not broken; don't "fix" the access logger.

**One traceback per failure.** Registering an exception handler _adds_ a record, it
does not replace one: `ServerErrorMiddleware` re-raises after calling our handler so
the server can log the failure itself, and uvicorn writes the same ~8 KB traceback
through `uvicorn.error` — by then the middleware has reset the request-id ContextVar,
so that copy carries no id and cannot be correlated with the one the caller quotes.
`unhandled_exception_handler` therefore calls `mark_traceback_logged(exc)` once its
own record is out, and `DuplicateTracebackFilter` on the stdout handler drops any
later record carrying that same exception object. The stamp lives on the exception
rather than on a match against the server's message text, so it survives a uvicorn
upgrade, and it is narrow by construction: startup, shutdown and
`"Invalid HTTP request received."` carry no exception at all, and a failure that
never reached our handler is never stamped — all of them still reach the stream.

`JsonFormatter` promotes every non-standard record attribute to a top-level field,
so it explicitly drops uvicorn's `color_message`: an ANSI-coloured duplicate of
`message` with an unexpanded `%d` still in it, which is noise rather than caller
data. Add to `_NOISE_RECORD_ATTRS` if another dependency does the same thing.

- Get a logger with `logging.getLogger(__name__)` at module level. Don't add
  handlers to it; the JSON handler lives on the root logger and app loggers
  propagate to it (which is also what keeps pytest's `caplog` working).
- **Never f-string caller-supplied data into the message.** Pass it via `extra=`,
  where `json.dumps` escapes it — otherwise a newline in user input splits one
  record across two log lines and a downstream parser sees garbage.
- `extra=` keys become top-level fields, so they must not collide with the
  reserved `LogRecord` attributes (`message`, `module`, `filename`, `args`,
  `asctime`, `name`, `levelname`, …) — `Logger.makeRecord` raises `KeyError` if
  they do. Prefix domain fields instead (`pitch_id`, `organisation_name`).

```python
logger = logging.getLogger(__name__)

logger.info("Pitch declined", extra={"pitch_id": str(pitch.id), "reason": reason})
```

### Request correlation

`app/core/request_context.py` gives every request an id. It is taken from the
inbound `X-Request-ID` header when that value is safe (the header is
caller-controlled and reaches both the response and the logs, so an implausible
one is replaced with a generated id), returned on **every** response, and stamped
onto **every** record written while the request is handled — so a header value a
user quotes locates the whole request's output, not just its access record. The
middleware also writes one access record per request (method, path without the
query string, status, duration, and the acting user when authenticated).

- **Register it after `CORSMiddleware` in `main.py`.** `add_middleware` inserts at
  index 0 and the stack runs outermost-first, so the _last_ registration is the
  _outermost_ layer — which is what makes it see every request and lets its header
  survive out to the client. This is counter-intuitive; don't reorder it.
- **`CORSMiddleware` must list the header in `expose_headers`.** A browser hides
  any response header the server doesn't expose, and Starlette builds that list
  from config — it cannot detect a header an outer middleware added.
- Authentication is a dependency, so it runs _inside_ the middleware and can't be
  read back through a `ContextVar` (`call_next` runs the app in a child task).
  `get_current_user` stashes the acting user on `request.state`, which is backed
  by the shared ASGI scope and so is visible to the middleware afterwards.
- Successful liveness/readiness requests are logged at `DEBUG` rather than `INFO`,
  so routine probes don't bury real signal but are still available at `LOG_LEVEL=DEBUG`.

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
