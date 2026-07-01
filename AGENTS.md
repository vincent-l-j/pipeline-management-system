# AGENTS.md — Rozetta PMS

Mission boundaries and coding conventions for workers on this codebase. Read this
before implementing a feature. The mission-level contract is `validation-contract.md`;
the feature list is `features.json`; build/run/test commands are in `services.yaml`.

## Mission Boundaries

**Ports (this project only):**

- Frontend (Vite): 5173
- Backend (FastAPI/uvicorn): 8000
- PostgreSQL: 5432

Do not bind other ports or assume services on them.

**Database:**

- USE the `db` service from `docker-compose.yml` (Postgres 16) for local runtime.
- Backend **unit tests run against in-memory SQLite** (forced in `tests/conftest.py`)
  and must not require a running Postgres.
- Do not point the app at, or mutate, any database outside this project.

**Off-limits:**

- Docker containers and ports not belonging to this project.
- `methodology.md`, `validation-contract.md`, and the *shape* of `features.json`
  — do not rewrite the contract or invent assertions. The only edit a worker
  makes to `features.json` is flipping its own feature's `status`.
- Secrets: never commit `.env` or hardcode keys. `SECRET_KEY`, Azure, and
  `ANTHROPIC_API_KEY` come from the environment. Leave `ENABLE_DEV_LOGIN=false`
  for anything prod-like.

Workers: return to the orchestrator if you cannot complete the work within these
boundaries, or if a feature's `expectedBehavior` conflicts with an assertion in
`validation-contract.md`.

## Test-Driven Development

- Write tests **before** code; tests encode intended behaviour, not implementation.
- Backend: `pytest` in `backend/tests/`, using the `admin_client` / `assessor_client`
  / `viewer_client` fixtures (`conftest.py`). Keep `follow_redirects=False`. Add
  test-only deps to `requirements-dev.txt`.
- Frontend: Vitest + React Testing Library, co-located in `__tests__/` next to the
  component; mock `src/services/api`.
- You iterate until you believe the work is correct, then hand off. Final
  correctness is decided by an independent validator against the contract — do not
  mark your own work validated.

## Backend Conventions (Python 3.12, FastAPI, SQLAlchemy 2.0)

- One router per resource under `app/api/routes/`, registered in `app/main.py`
  with `prefix="/api"`.
- `redirect_slashes = False` is set: declare routes **without** trailing slashes
  (there is a regression test pinning this).
- Models: SQLAlchemy 2.0 typed style (`Mapped[...]` / `mapped_column`), UUID
  primary keys (`default=uuid.uuid4`), `TimestampMixin`, `str`-based `Enum`s for
  enumerated columns. No raw SQL — use the session from `get_db`.
- Schemas: Pydantic v2, separate `*Create` / `*Update` / `*Out` per resource.
  `*Out` sets `model_config = {"from_attributes": True}`. `*Update` fields are
  optional and applied with `model_dump(exclude_unset=True)`. Schemas are explicit
  allowlists — never widen one just to pass a field through.
- **Authorization is server-side and mandatory.** Use `Depends(get_current_user)`
  for authn and `Depends(require_role(...))` for authz on every mutating or
  privileged endpoint. The frontend is never the security boundary.
- **Least-privilege responses.** Return only the fields the caller needs; do not
  leak emails/roles/identifiers to roles that shouldn't see them (e.g. the user
  directory vs. the admin user list).

## Frontend Conventions (React 18, Vite, React Router 6, Tailwind)

- Function components + hooks. Routes live in `App.jsx` wrapped in `ProtectedRoute`;
  admin-only routes additionally guard on role.
- **All HTTP goes through `src/services/api.js`** (axios, `baseURL: '/api'`, bearer-token
  and 401 interceptors). Do not call `fetch`/`axios` directly elsewhere.
- Auth/role via `useAuth()` (`AuthContext`); `token`/`user` persist in `localStorage`.
  Role-based UI gating (e.g. `user.role === 'admin'`) is **UX only, not a security
  control** — the backend must independently enforce it.
- Styling: Tailwind utilities, existing `navy`/`teal` palette; match surrounding
  components rather than introducing new patterns.
- The Vite dev proxy targets `http://backend:8000` (Docker). For host-only dev,
  point it at `http://localhost:8000`.

## Version control

Optimise commits and PRs for easy review — smaller and more focused is always
preferred.

- **Start clean.** Begin from a clean working tree; never commit on a detached
  `HEAD` or directly on `main`. Create a branch off `main` first.
- **A branch and PR per feature.** One `features.json` id → one branch
  (`feat/<feature-id>`) → one PR. Backend and frontend are separate feature ids,
  so they land as separate, smaller PRs — don't combine them.
- **Small, focused commits.** Split a feature into coherent steps (e.g. schema,
  then route, then wiring) rather than one big commit. Keep a test with the code
  it covers. Each commit should build; all tests must be green at the branch tip
  before opening the PR.
- **One concern per commit/PR.** Never fold in unrelated changes or drive-by
  refactors. Update any docs the change touches in the same PR (see
  `docs/best-practices/README.md`).
- **Messages:** Conventional Commits, imperative mood —
  `feat:` / `test:` / `fix:` / `refactor:` / `docs:`, e.g.
  `feat(contacts): cascade-delete join rows on contact delete`.
- **Never commit** secrets, `.env`, or generated/vendored files.

## Definition of Done (per feature)

- Tests written first and passing (`services.yaml` → `test-backend` / `test-frontend`).
- Every `VAL-*` id the feature `fulfills` is observably satisfied on the running stack.
- Server-side authorization verified for any restricted action (not just hidden UI).
- No new lint/secret/boundary violations; `status` flipped to reflect completion.
