# CLAUDE.md

Guidance for Claude Code working in this repository. Start here, then follow the
pointers below.

## What this is

**Rozetta PMS** — a pipeline management system for tracking research/innovation
pitches. FastAPI + PostgreSQL backend, React + Vite + Tailwind frontend, deployed
on DigitalOcean App Platform. See `README.md` for the product overview and
`docs/architecture.md` for how the stack fits together.

The project's principles are in the [constitution](.specify/memory/constitution.md).
How it ranks against this file and the other docs is at the top of
[`AGENTS.md`](AGENTS.md).

## Commands

Canonical commands live in `services.yaml`. In short:

| Task                   | Command                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| Run the whole stack    | `docker compose up --build`                                               |
| Backend tests          | `cd backend && pytest` (needs the `db` service up)                        |
| Frontend tests         | `cd frontend && npm test` (jsdom)                                         |
| Frontend browser tests | `cd frontend && npm run test:browser` (needs a Chromium; CI installs one) |
| Frontend build         | `cd frontend && npm run build`                                            |
| Backend health         | `curl -sf http://localhost:8000/api/health`                               |
| Backend readiness      | `curl -sf http://localhost:8000/api/health/ready`                         |
| API docs (Swagger)     | http://localhost:8000/docs                                                |
| Lint (both sides)      | `npm run lint`                                                            |
| Lint, autofix          | `npm run lint:fix`                                                        |
| Typecheck (frontend)   | `npm run typecheck`                                                       |
| Format                 | `npm run format` / `npm run format:check`                                 |

All of these run from the **repo root**, but only prettier lives there — the root
`package.json` is a thin delegator. eslint + typescript are `frontend/`
devDependencies (with `frontend/eslint.config.mjs`), and ruff comes from
`backend/requirements-dev.txt` (configured in `backend/pyproject.toml`). Each
linter's config sits with the code it lints. So `npm install` at the root is enough for format,
while lint and typecheck need `npm install --prefix frontend`. There is no backend
type checker (no mypy) — don't assume one.

The typecheck bakes in `tsc -b --force`. It has to: `tsc -b` doesn't replay stored
errors for unchanged files, so an incremental run over stale build info can print
nothing while real errors remain. **Don't write `npm run typecheck -- --force`** —
npm treats `--force` as its own flag and never forwards it to tsc, so that spelling
silently doesn't force.

## Repository map

```
backend/app/   FastAPI: api/routes, core (config/db/security), models, schemas, services
frontend/src/  React: pages, components, contexts, services/api.ts
docs/          architecture.md, best-practices/
specs/         one directory per feature: spec, plan, research, tasks
.specify/      Spec Kit templates, scripts, and the constitution (memory/)
sop/           db bootstrap/migration runbooks, tooling, instance sheets
```

## How work is organized (read these first)

Features are specified and built with Spec Kit, following **`methodology.md`**. The
artifacts are:

- **`specs/<feature>/spec.md`** — the feature's user stories and acceptance
  scenarios. How a spec is kept up to date, and how correctness is judged against
  it, is in `methodology.md` ("Design principles").
- **`specs/<feature>/plan.md`, `tasks.md`** — the design, its Constitution Check,
  and the dependency-ordered tasks, each story with its independent test.
- **`AGENTS.md`** — boundaries + coding conventions. Read before editing.
- **`services.yaml`** — build/run/test commands and services.
- **`sop/`** — Standard Operating Procedures: runbooks for database bootstrap
  (`db-bootstrap.md`), schema changes (`db-change.md`), and tooling (`bin/db.sh`).
  See `sop/instances/rozetta-pms.md` for app-specific values.

To implement a feature, run the Spec Kit steps in `methodology.md`. Implementing
means reading the spec's acceptance scenarios → the plan → `AGENTS.md` → the
relevant best-practices doc → **write tests first** → implement → run the story's
independent test from `tasks.md`. `methodology.md` also covers the path for a small
bug fix, and what to do with a defect's lesson or an idea for an automated check.

## Reference docs

- Principles every plan and diff is checked against, cited by id (C1–C6, A4–A22) —
  [`.specify/memory/constitution.md`](.specify/memory/constitution.md)

See [`docs/best-practices/`](docs/best-practices/README.md) (the index also documents
how to keep these docs in sync with the code — in short: code wins, and update a doc
in the same change that alters the pattern it describes).

- When (rarely) to comment — [`docs/best-practices/code-clarity.md`](docs/best-practices/code-clarity.md)
- Backend patterns & pytest — [`docs/best-practices/backend-fastapi.md`](docs/best-practices/backend-fastapi.md)
- React, Vitest & Tailwind — [`docs/best-practices/frontend-react.md`](docs/best-practices/frontend-react.md)
- Frontend/backend/DB integration — [`docs/best-practices/database-integration.md`](docs/best-practices/database-integration.md)
- Alembic migrations, deployment and rollback — [`docs/best-practices/migrations.md`](docs/best-practices/migrations.md)
- SOLID design principles (why the conventions are shaped this way) — [`docs/best-practices/solid-principles.md`](docs/best-practices/solid-principles.md)

## Golden rules

1. **Tests first (TDD).** Tests encode intended behaviour; write them before code.
   You don't judge your own work correct, and done is C6. Who judges, and how done
   applies to each kind of change, is in `methodology.md`.
2. **The backend is the only security boundary.** Enforce authz server-side with
   `require_role`. Frontend role checks (`user.role`) are UX only — `localStorage`
   is client-controlled.
3. **Least-privilege responses.** Return only the fields a caller needs; add a
   narrow schema/endpoint rather than leaking a full record to a low-privilege role.
4. **All frontend HTTP goes through `src/services/api.ts`.** Never call
   `fetch`/`axios` directly.
5. **No trailing slashes on routes** (`redirect_slashes=False`, regression-tested).
6. **Pydantic schemas are allowlists.** Don't widen one to pass a field through;
   keep non-client-settable fields (e.g. `current_stage` on `PitchUpdate`) out.
7. **Enforce data integrity in app code, not DB cascades** — a cascade fires below
   the boundary the API tests assert at, so the behaviour would be untestable
   through the API. (The old reason, "SQLite tests don't enforce foreign
   keys", no longer holds: the suite runs on Postgres.) See the integration doc.
8. **API fields are `snake_case`** on both sides of the wire; don't rename on the
   frontend.
9. **Secrets come from the environment**, never committed. Keep `ENABLE_DEV_LOGIN`
   off for anything prod-like.
10. **Commit small and focused (SRP).** Smaller, single-concern commits and PRs
    are always preferred — a branch + PR per feature, tests with their code, green
    at the tip. See **Version control** in `AGENTS.md` for the full workflow.

## Boundaries

Ports: frontend 5173, backend 8000, Postgres 5432 — this project only. Don't touch
other containers/ports. The constitution changes only through its own amendment PR.
Durable files (code, tests, comments, best-practices rules) never cite ephemeral ids
such as task ids or branch names. Full details in `AGENTS.md`.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `vincent-l-j/pipeline-management-system`, driven by
the `gh` CLI. Issues hold work that isn't specified yet; `specs/` holds features that
are. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, created lazily.
See `docs/agents/domain.md`.

### Driving the running app

The stack is already up. Drive it in a real browser before opening a PR, not only
the suites. `docs/agents/local-testing.md` has the address to use, the browser to
use, and what to do with what you find.
