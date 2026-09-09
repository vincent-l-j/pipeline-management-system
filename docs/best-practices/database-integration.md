# Best practices — frontend ⇄ backend ⇄ database integration

How the three layers connect in this repo, and the rules that keep them in sync.

## Request lifecycle

```
React component
  → src/services/api.js (axios, baseURL "/api", attaches Bearer token)
    → dev:  Vite proxy forwards /api → http://backend:8000  (vite.config.js)
      prod: same origin; App Platform routes /api to the backend
    → FastAPI route (app/api/routes/*)
      → Depends(get_db) → SQLAlchemy Session → PostgreSQL
      ← *Out Pydantic schema (response_model)
  ← axios response.data
```

The frontend never talks to the database, and never constructs URLs beyond the
`/api` prefix. The backend never trusts the client for identity or authorization.

## The API contract is the `*Out` schema

- The JSON the frontend consumes **is** the backend's `*Out` schema. Field names
  are `snake_case` (e.g. `organisation_id`, `current_stage`, `is_confidential`) —
  use them verbatim on the frontend; do not rename to camelCase.
- Changing an `*Out` schema is a breaking change for every component that reads
  it. When you add/rename/remove a field, update the consumers and their tests in
  the same feature.
- Enum values cross the wire as their string value (`"received"`, `"admin"`).
  The frontend keeps its display labels in config modules (`PipelineConfig.js`,
  `AssessmentConfig.js`) keyed by those raw values — extend those maps, don't
  hardcode labels inline.

## Sessions, transactions, and integrity

- One `Session` per request via `get_db`; commit explicitly, then `db.refresh(obj)`
  before returning so the response reflects DB-generated values.
- **Enforce cross-aggregate integrity in application code, not via DB cascades.**
  The schema defines no `ON DELETE` anywhere, and the reason is testability at the
  boundary that matters: behaviours like "nulling `organisation_id` on child rows
  when an org is deleted" or "deleting a contact's join rows" are part of what the
  API promises, so they belong in the route/service where a test can assert the
  side effect through the API. A DB cascade happens underneath that boundary — the
  rows change and no test of the contract can see how.
  (This used to be justified by SQLite not enforcing foreign keys in tests. It now
  does — the suite runs on Postgres — so a cascade would at least be _exercised_;
  the reason above is why the rule stands anyway.)
- **A cascade only knows about rows.** Where an aggregate owns state outside the
  database, the route that deletes it purges that state _first_ and aborts if the
  external store refuses — a row whose file is gone can be found and cleaned up,
  while a file with no row is invisible to everyone. `delete_pitch` and
  `delete_attachment` both hold to this: the `delete-orphan` cascade on
  `Pitch.attachments` would otherwise drop the only pointer each file has.
- Keep multi-step writes in a single transaction (mutate, `db.add(...)`, one
  `db.commit()`) so a failure can't leave a half-applied change.

## Schema management

- Schema management follows the two-stage lifecycle in
  [`migrations.md`](migrations.md) (`create_all` scaffolding → managed Alembic
  migrations). Which stage a given app is in — and whether the deploy migrate job is
  live — is tracked in its instance sheet (`sop/instances/<app>.md`), not asserted here.
- **While still on `create_all`:** tables are auto-created from the models on startup —
  fine for first run and tests — but a _changed_ column is **not** picked up by an
  existing database, so local dev may need a volume reset (`docker compose down -v`) and
  there is no deploy-time schema change or rollback. That limitation is the trigger to run
  the `db-bootstrap.md` SOP (see "When to bootstrap" in `migrations.md`).
- **Once bootstrapped:** every schema change is an Alembic migration applied by
  `alembic upgrade head` (a PRE_DEPLOY job on deploy); `create_all` is gone. Use the
  `db-change.md` SOP per change.

## Auth across the boundary

- Login yields a JWT; the frontend stores it in `localStorage` and `api.js`
  attaches it as `Authorization: Bearer <token>` on every request.
- A `401` anywhere triggers the response interceptor to clear storage and redirect
  to `/login` — components don't need to handle expiry themselves.
- Authorization is **server-side only**. A component may hide an admin button, but
  the backend `require_role` check is what actually protects the action. Integration
  correctness means: the disallowed role gets a `403` from the API even if it
  crafts the request by hand.
- Auth uses a bearer header, not cookies, so requests are not CSRF-exposed; the
  tradeoff is that any XSS could read the token, so never render untrusted HTML
  (React escaping + no `dangerouslySetInnerHTML`).

## Environments & CORS

- **Dev:** three containers (`db`, `backend`, `frontend`); the Vite proxy hides
  the origin difference, so `/api` calls are same-origin from the browser's view.
  Running the frontend outside Docker means changing the proxy target to
  `http://localhost:8000`.
- **Prod (App Platform):** SPA and API share one origin, so CORS is barely
  exercised; `VITE_API_BASE_URL=/api` is inlined at **build time**.
- `BACKEND_CORS_ORIGINS` must list the frontend origin in any split-origin setup.

## Testing the integration

- **Backend**: `TestClient` against a disposable Postgres exercises the full
  route → ORM → real-schema path. This is where API-shape and integrity assertions
  live. It needs the `db` service up (`APP_TEST_DATABASE_URL`, default
  `pms_app_test`); the schema is rebuilt from the migrations per run and every
  table truncated between tests.
- **Frontend**: mock `services/api` so components are tested against the _contract_
  (the shapes above), not a live backend. Keep mock payloads faithful to the real
  `*Out` schema — a drifted mock hides integration breaks.
- **End-to-end**: the contract's `VAL-*` assertions are verified black-box
  against the running stack (`services.yaml` brings it up; health at
  `/api/health`). That's the layer that catches proxy/CORS/field-name mismatches
  the unit tests can't.

## Common integration failures to watch for

- Frontend expecting camelCase while the API returns snake_case (or vice-versa).
- Locking down an endpoint (e.g. `GET /api/users` → admin-only) without noticing
  other consumers depend on it — check every caller before narrowing access, and
  add a purpose-built endpoint if a low-privilege caller still needs a subset.
- Cascade/orphan logic left to the DB instead of the application layer, where no
  test of the API contract can observe it.
- Mock payloads in frontend tests that no longer match the real schema.
