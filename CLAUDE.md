# CLAUDE.md

Guidance for Claude Code working in this repository. Start here, then follow the
pointers below.

## What this is

**Rozetta PMS** — a pipeline management system for tracking research/innovation
pitches. FastAPI + PostgreSQL backend, React + Vite + Tailwind frontend, deployed
on DigitalOcean App Platform. See `README.md` for the product overview and
`docs/architecture.md` for how the stack fits together.

## Commands

Canonical commands live in `services.yaml`. In short:

| Task | Command |
|------|---------|
| Run the whole stack | `docker compose up --build` |
| Backend tests | `cd backend && pytest` |
| Frontend tests | `cd frontend && npm test` |
| Frontend build | `cd frontend && npm run build` |
| Backend health | `curl -sf http://localhost:8000/api/health` |
| API docs (Swagger) | http://localhost:8000/docs |

There is no lint/typecheck tooling configured — don't assume one exists.

## Repository map

```
backend/app/   FastAPI: api/routes, core (config/db/security), models, schemas, services
frontend/src/  React: pages, components, contexts, services/api.js
docs/          architecture.md, c4/, best-practices/
```

## How work is organized (read these first)

This repo follows the multi-agent methodology in **`methodology.md`**. The
mission-control artifacts at the root are:

- **`validation-contract.md`** — the black-box `VAL-*` behavioural assertions that
  define correctness. This is the source of truth for "done".
- **`features.json`** — the feature list; each feature declares which `VAL-*`
  assertions it `fulfills` and lists its `verificationSteps`.
- **`AGENTS.md`** — mission boundaries + coding conventions. Read before editing.
- **`services.yaml`** — build/run/test commands and services.

To implement a feature: read its `features.json` entry → the `VAL-*` assertions it
fulfills → `AGENTS.md` → the relevant best-practices doc → **write tests first** →
implement → run the feature's `verificationSteps`.

## Reference docs

See [`docs/best-practices/`](docs/best-practices/README.md) (the index also documents
how to keep these docs in sync with the code — in short: code wins, and update a doc
in the same change that alters the pattern it describes).

- Backend patterns & pytest — [`docs/best-practices/backend-fastapi.md`](docs/best-practices/backend-fastapi.md)
- React, Vitest & Tailwind — [`docs/best-practices/frontend-react.md`](docs/best-practices/frontend-react.md)
- Frontend/backend/DB integration — [`docs/best-practices/database-integration.md`](docs/best-practices/database-integration.md)
- SOLID design principles (why the conventions are shaped this way) — [`docs/best-practices/solid-principles.md`](docs/best-practices/solid-principles.md)

## Golden rules

1. **Tests first (TDD).** Tests encode intended behaviour; write them before code.
   Final correctness is judged by validators against `validation-contract.md`, not
   by the implementer.
2. **The backend is the only security boundary.** Enforce authz server-side with
   `require_role`. Frontend role checks (`user.role`) are UX only — `localStorage`
   is client-controlled.
3. **Least-privilege responses.** Return only the fields a caller needs; add a
   narrow schema/endpoint rather than leaking a full record to a low-privilege role.
4. **All frontend HTTP goes through `src/services/api.js`.** Never call
   `fetch`/`axios` directly.
5. **No trailing slashes on routes** (`redirect_slashes=False`, regression-tested).
6. **Pydantic schemas are allowlists.** Don't widen one to pass a field through;
   keep non-client-settable fields (e.g. `current_stage` on `PitchUpdate`) out.
7. **Enforce data integrity in app code, not DB cascades** — SQLite tests don't
   enforce foreign keys. See the integration doc.
8. **API fields are `snake_case`** on both sides of the wire; don't rename on the
   frontend.
9. **Secrets come from the environment**, never committed. Keep `ENABLE_DEV_LOGIN`
   off for anything prod-like.
10. **Commit small and focused (SRP).** Smaller, single-concern commits and PRs
    are always preferred — a branch + PR per feature, tests with their code, green
    at the tip. See **Version control** in `AGENTS.md` for the full workflow.

## Boundaries

Ports: frontend 5173, backend 8000, Postgres 5432 — this project only. Don't touch
other containers/ports. Don't rewrite `methodology.md` / `validation-contract.md`
or invent assertions; a worker's only edit to `features.json` is its own feature's
`status`. Full details in `AGENTS.md`.
