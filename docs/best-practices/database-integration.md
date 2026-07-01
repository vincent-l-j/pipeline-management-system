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
  Unit tests run on SQLite with foreign-key enforcement *off*, and startup uses
  `Base.metadata.create_all` (no migration-defined `ON DELETE`). So behaviours
  like "nulling `organisation_id` on child rows when an org is deleted" or
  "deleting a contact's join rows" must be done in the route/service and covered
  by tests that assert the side effect. Relying on `ondelete=` would pass in
  Postgres but silently no-op under the test DB.
- Keep multi-step writes in a single transaction (mutate, `db.add(...)`, one
  `db.commit()`) so a failure can't leave a half-applied change.

## Schema management

- Tables are auto-created on startup (`create_all`) — fine for first run and for
  tests. There is no migration wired into deploy yet; when a column changes,
  existing dev/prod databases won't pick it up automatically. Alembic is
  configured (`backend/alembic.ini`) for when managed migrations are turned on
  (see the production notes in the README). Until then, schema changes may need a
  volume reset locally (`docker compose down -v`).

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

- **Backend**: `TestClient` against SQLite exercises the full route → ORM path
  quickly (no live DB). This is where API-shape and integrity assertions live.
- **Frontend**: mock `services/api` so components are tested against the *contract*
  (the shapes above), not a live backend. Keep mock payloads faithful to the real
  `*Out` schema — a drifted mock hides integration breaks.
- **End-to-end**: the validation-contract `VAL-*` assertions are verified black-box
  against the running stack (`services.yaml` brings it up; health at
  `/api/health`). That's the layer that catches proxy/CORS/field-name mismatches
  the unit tests can't.

## Common integration failures to watch for

- Frontend expecting camelCase while the API returns snake_case (or vice-versa).
- Locking down an endpoint (e.g. `GET /api/users` → admin-only) without noticing
  other consumers depend on it — check every caller before narrowing access, and
  add a purpose-built endpoint if a low-privilege caller still needs a subset.
- Cascade/orphan logic that passes on Postgres but not SQLite (or vice-versa)
  because it was left to the DB instead of the application layer.
- Mock payloads in frontend tests that no longer match the real schema.
