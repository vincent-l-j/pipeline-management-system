# AGENTS.md — Rozetta PMS

Boundaries and coding conventions for anyone changing this codebase. Read this
before implementing a feature. Each feature's spec, plan and tasks live under
`specs/<feature>/` (see `methodology.md`); build/run/test commands are in
`services.yaml`.

The [constitution](.specify/memory/constitution.md) governs principles, and the
Spec Kit commands check every plan against it. This file, `CLAUDE.md` and
`docs/best-practices/` hold tool names, versions, style and workflow. Where one of
them seems to contradict the constitution, the constitution wins until it is
amended.

## Boundaries

**Ports (this project only):**

- Frontend (Vite): 5173
- Backend (FastAPI/uvicorn): 8000
- PostgreSQL: 5432

Do not bind other ports or assume services on them.

**Database:**

- USE the `db` service from `docker-compose.yml` (Postgres 16) for local runtime.
- Backend tests **run against a disposable PostgreSQL database** built by the
  migrations (`APP_TEST_DATABASE_URL` in `tests/conftest.py`, defaulting to the
  `db` service). They need Postgres up; that is deliberate — SQLite could not fail
  the way the real database does. The schema is rebuilt per run and every table is
  truncated between tests, so never point it at a database that matters, and never
  at the migration suite's `TEST_DATABASE_URL`.
- Do not point the app at, or mutate, any database outside this project.

**Off-limits:**

- Docker containers and ports not belonging to this project.
- The constitution (`.specify/memory/constitution.md`). It changes only through its
  own amendment PR, never as part of feature work.
- Ephemeral ids in durable files. Code, tests, comments and best-practices rules
  never cite a task id from `tasks.md`, a branch name or anything else that gets
  deleted or renumbered (see `methodology.md`).
- Secrets: never commit `.env` or hardcode keys. `SECRET_KEY`, Azure, and
  `ANTHROPIC_API_KEY` come from the environment. Leave `ENABLE_DEV_LOGIN=false`
  for anything prod-like.

Stop and ask the user if the work can't be done within these boundaries, or if it
conflicts with the feature's spec.

## Test-Driven Development

- Write tests **before** code; tests encode intended behaviour, not implementation.
- Backend: `pytest` in `backend/tests/`, using the `admin_client` / `assessor_client`
  / `viewer_client` fixtures (`conftest.py`). Those fixtures override the project's
  own `get_current_user`, which is grandfathered under C3. Keep
  `follow_redirects=False`. Add test-only deps to `requirements-dev.txt`.
- Frontend: Vitest + React Testing Library, co-located in `__tests__/` next to the
  component. Existing tests mock `src/services/api`, a mock of the project's own
  code grandfathered under C3; a new test doesn't extend it without recording the
  exception in its plan. Anything that depends on CSS — stacking
  order, print rules, breakpoint gating, measured size — goes in the real-browser
  suite (`*.browser.test.tsx`) instead, because jsdom passes it vacuously. See
  `docs/best-practices/frontend-react.md` for which seam takes what.
- **Don't cite task ids in tests or comments.** Test names and docstrings describe
  the behaviour they check, not which task or spec item they came from.
- You iterate until you believe the work is correct, then hand off. Correctness is
  judged against the spec's acceptance scenarios via `/speckit-analyze`,
  `/speckit-converge` and a PR review — never self-validated. A small bug fix with
  no spec is judged against its issue.
- **Lessons and proposals** (see `methodology.md`): a lesson from a defect becomes a
  rule in `docs/best-practices/` in the PR that fixes it, merged into an existing
  rule where possible. An idea for an automated check is filed as a `needs-triage`
  GitHub issue.

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

- Function components + hooks. Routes live in `App.tsx` wrapped in `ProtectedRoute`;
  admin-only routes additionally guard on role. One exception, and only one:
  `src/components/ErrorBoundary.tsx` is a class because React 18 gives
  `getDerivedStateFromError` / `componentDidCatch` no hook equivalent. Don't add
  another class component.
- **All HTTP goes through `src/services/api.ts`** (axios, `baseURL: '/api'`, bearer-token
  and 401 interceptors). Do not call `fetch`/`axios` directly elsewhere.
- Interactive elements are native controls or carry the matching role and keyboard
  handling; no `<div onClick>` (A4). Anything a user would bookmark or share lives
  in the URL (A7).
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
  `HEAD` or directly on `main`. `git fetch` first and cut from the remote ref —
  `git checkout -b <new> origin/main` — because a local branch ref is a cached
  answer of unknown age. Before building on an earlier branch, check ancestry, not
  the diff: `git merge-base --is-ancestor <base> origin/main`. A "no" with an empty
  diff means the earlier branch was squash-merged, so base on `origin/main`.
- **PRs target `main`.** `develop` only deploys the staging (UAT) app; see
  `README.md` ("Production deployment") for when to push to it.
- **One branch per PR, one concern per PR.** A spec (or issue) lands as one or more
  PRs, each on its own branch. Backend and frontend land as separate, smaller PRs —
  don't combine them.
- **A specified feature's branches start with its spec directory's name**, as Spec
  Kit numbers it under `specs/` (see `methodology.md`) — for example
  `001-align-docs-constitution-decisions` for a later PR on
  `specs/001-align-docs-constitution/`.
- **A change without a spec names its branch for what it does.** The prefix is the
  Conventional Commit type of the work it carries, not a fixed `feat/` — `ci/lint-workflows`,
  `refactor/clean-test-output`, `docs/frontend-typescript-best-practice`. Where
  the commits mix types, use the dominant one; a feature plus its docs is still
  `feat/`. A branch prefixed `feat/` whose commits are all `fix:` misleads the
  reviewer before they open a single file.
- **Small, focused commits.** Split a feature into coherent steps (e.g. schema,
  then route, then wiring) rather than one big commit. Keep a test with the code
  it covers. Each commit should build; all tests must be green at the branch tip
  before opening the PR.
- **Drive the app at the branch tip, not only the suites.** Green tests and a
  used app answer different questions, and the second one is where layout,
  navigation and real-data bugs surface. Match the shape to the diff: a frontend
  change gets walked in a browser, a backend change gets its touched routes
  called against the running stack and the bodies read. The viewports to run, the
  address to reach, and where each finding goes are in
  `docs/agents/local-testing.md`.
- **One concern per commit/PR.** Never fold in unrelated changes or drive-by
  refactors. Update any docs the change touches in the same PR (see
  `docs/best-practices/README.md`).
- **Messages:** Conventional Commits, imperative mood —
  `feat:` / `test:` / `fix:` / `refactor:` / `docs:` / `chore:` / `build:`, e.g.
  `fix: enforce one link per pitch-contact pair`.
- **No scopes in the subject.** Write `feat:`, never `feat(contacts):`. Every
  commit since mid-July is bare; the type plus an imperative summary is the whole
  subject.
- **A PR body carries what the diff cannot derive** — why the change exists, what
  was considered and rejected, what was verified and how. Don't transcribe the
  diff or count it; the diff regenerates on every push and the body does not, so
  a transcription is wrong by the next one. Give a path for anything the diff does
  not contain, because the diff is the reviewer's only context. Rule 3 in
  `docs/best-practices/README.md` is the general form.
- **Never commit** secrets, `.env`, or generated/vendored files.

## Definition of Done (per feature)

- Tests written first and passing (`services.yaml` → `test-backend` / `test-frontend`).
  A bug fix starts with a test that reproduces it and failed before the fix (C3).
- Every acceptance scenario in the feature's spec is observably satisfied on the
  running stack — observed by using the app, not inferred from a passing test.
- Server-side authorization verified for any restricted action (not just hidden UI).
- No new lint/secret/boundary violations.
- Any new repeatable command is added to `services.yaml`, and CI invokes that same
  command (C4).
- The plan's Constitution Check states how the change is reverted, and the revert
  takes under five minutes without a code change (C5).
- Correctness is confirmed by `/speckit-analyze`, `/speckit-converge` and a PR
  review against the spec (see the TDD section above), never by the implementer
  alone. A small bug fix with no spec is reviewed against its issue instead (see
  `methodology.md`).
- If the change alters a specified feature, its spec was updated first, in the same
  PR.
- **Done means deployed, not merged.** The change is in production and the signal
  its plan's Constitution Check named has been checked (C6). A docs-only change is
  done when it merges to `main`.
