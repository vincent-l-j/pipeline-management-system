# Rozetta PMS

**Rozetta Institute Pipeline Management System** — a web app for tracking research and innovation initiatives ("pitches") as they move through Rozetta's evaluation pipeline.

It records pitches from submission to final decision, logs meetings (with optional AI-powered note parsing via Claude), scores pitches against a structured assessment framework, surfaces pipeline health on a dashboard, and exports data to CSV.

## Features

- **Pipeline board** — drag-and-drop Kanban across 10 stages (Received → … → Completed), plus a list view with filters
- **Pitches** — full records with source, funding pathway, domains, lead, confidentiality, linked files, and an activity timeline
- **Organisations & Contacts** — external parties linked to pitches and meetings
- **Meetings** — summaries, key points, action items, attendees, and an **AI Notetaker** that turns raw notes into structured records (Claude, with a basic-parser fallback)
- **Assessments** — versioned scoring against 6 criteria (1–5) with a Proceed / Park / Decline recommendation; prior versions are never overwritten
- **Dashboard, full-text search, and reports** with CSV export
- **Role-based access** — Admin, Assessor, Viewer

For end-user documentation, see [`Rozetta_PMS_User_Guide.md`](./Rozetta_PMS_User_Guide.md).

## Tech stack

| Layer    | Technology                                                                            |
| -------- | ------------------------------------------------------------------------------------- |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic, Alembic                               |
| Database | PostgreSQL 16                                                                         |
| Auth     | Microsoft Azure AD (MSAL) + JWT, with a dev-login fallback                            |
| AI       | Anthropic Claude API (AI Notetaker)                                                   |
| Frontend | React 18, Vite 6, React Router 6, Tailwind CSS, axios, @hello-pangea/dnd              |
| Infra    | Docker Compose (local dev); DigitalOcean App Platform + Managed Postgres (production) |

## Architecture

```
rozetta-pms/
├── backend/            FastAPI app
│   ├── app/
│   │   ├── api/routes/  per-resource endpoints (pitches, meetings, …)
│   │   ├── core/        config, database, security
│   │   ├── models/      SQLAlchemy models
│   │   ├── schemas/     Pydantic schemas
│   │   ├── services/    AI notetaker, etc.
│   │   └── main.py      app entry point
│   └── requirements.txt
├── frontend/           React + Vite SPA
│   └── src/            pages, components, contexts, services
└── docker-compose.yml  db (5432) + backend (8000) + frontend (5173)
```

The frontend proxies `/api` requests to the backend (see `frontend/vite.config.js`). The database schema is managed by Alembic — run `alembic upgrade head` to create/update tables (see [Database migrations](#database-migrations)).

For a fuller breakdown of how the dev and production stacks differ (containers, routing, build stages, and where tests run), see [`docs/architecture.md`](./docs/architecture.md).

## Quick start (Docker — recommended)

Requires **Docker** and **Docker Compose**.

```bash
# 1. Create your environment file and edit the secrets
cp .env.example .env
#    At minimum, set a strong POSTGRES_PASSWORD and SECRET_KEY.
#    Generate a SECRET_KEY with:  openssl rand -hex 32
#    Azure AD and ANTHROPIC_API_KEY are optional (see below).

# 2. Build and start all services
docker compose up --build
```

Once running:

- Frontend: **http://localhost:5173**
- Backend API: **http://localhost:8000/api**
- Interactive API docs (Swagger): **http://localhost:8000/docs**
- Health check: **http://localhost:8000/api/health**

To stop: `docker compose down` (add `-v` to also drop the database volume).

## Logging in

- **Microsoft login** — requires Azure AD credentials in `.env` (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`). Only `@rozettainstitute.com` accounts are accepted.
- **Dev Login (Admin)** — if Azure AD is not configured, click **"Dev Login (Admin)"** on the login page (backed by `GET /api/auth/dev-token`). This creates/returns a test admin account. **For development only — remove before production.**

## Environment variables

Copy `.env.example` to `.env` and fill in your values.

| Variable                                              | Required | Description                                                                                                                            |
| ----------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Yes      | Postgres credentials used by the `db` service                                                                                          |
| `DATABASE_URL`                                        | Yes      | SQLAlchemy connection string (defaults to the `db` service)                                                                            |
| `SECRET_KEY`                                          | Yes      | Secret used to sign JWTs. Generate a fresh one with `openssl rand -hex 32` (required — no default; the app refuses to boot without it) |
| `BACKEND_CORS_ORIGINS`                                | Yes      | Comma-separated allowed origins (e.g. `http://localhost:5173`)                                                                         |
| `AZURE_CLIENT_ID` / `AZURE_TENANT_ID`                 | Optional | Microsoft OAuth (omit to use Dev Login)                                                                                                |
| `AZURE_CLIENT_SECRET`                                 | Yes      | Required for Microsoft OAuth (no default → app won't boot)                                                                             |
| `ANTHROPIC_API_KEY`                                   | Optional | Enables AI note parsing; without it, a basic text parser is used                                                                       |

## Running locally without Docker

Useful for active development. You still need a PostgreSQL instance — either run just the database via Docker (`docker compose up db`) or point `DATABASE_URL` at your own.

### Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Point DATABASE_URL at a reachable Postgres (e.g. localhost instead of "db")
export DATABASE_URL=postgresql://rozetta:yourpassword@localhost:5432/rozetta_pms

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # serves http://localhost:5173
```

> When running outside Docker, the Vite proxy target (`http://backend:8000` in `vite.config.js`) won't resolve. Change it to `http://localhost:8000` for local-only development.

### Database migrations

The schema is owned by **Alembic** (`backend/alembic.ini`); the app no longer creates tables
on startup. Every environment applies migrations before release — in production/staging the
`PRE_DEPLOY` `migrate` job runs `alembic upgrade head`; locally:

```bash
cd backend
alembic revision --autogenerate -m "your message"   # after changing models
alembic upgrade head
```

See [`sop/db-change.md`](./sop/db-change.md) for the full schema-change runbook.

## Production deployment

Production runs on **DigitalOcean App Platform**, declared as code in
[`.do/app.yaml`](./.do/app.yaml). There is no server to provision, no Docker Compose, and no
reverse proxy to run yourself. Deploys are **GitOps**: CI applies the spec, not App Platform's
push-to-deploy (see [Shipping updates](#shipping-updates)). The spec defines four things:

| Component                    | How it's deployed                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend** (FastAPI)        | A _service_ built from `backend/Dockerfile` (App Platform builds the final `prod` stage and overrides its CMD via `run_command`). Routed at `/api`, health check at `/api/health`.                                     |
| **Frontend** (React SPA)     | A _static site_ built with App Platform's Node buildpack (`npm run build` → `dist/`), served from the edge at `/`. SPA deep links fall back to `index.html`. Same origin as the backend, so `/api` calls need no CORS. |
| **Database** (PostgreSQL 16) | A _managed database_ (`databases:` block). `DATABASE_URL` is injected automatically — no `db` container in production.                                                                                                 |
| **Migrate job** (Alembic)    | A `PRE_DEPLOY` job that runs `alembic upgrade head` against the DB before each release, so schema changes ship atomically with the code that needs them. Needs only `DATABASE_URL`, not the app secrets.               |

Because the SPA and API share one origin, there is no separate domain juggling and no TLS to
manage (App Platform terminates HTTPS for you), and the localStorage JWT travels normally.

### First deploy

1. Review `.do/app.yaml` and confirm the GitHub repo, Azure IDs, and `domains` match your
   environment (the app URL resolves automatically via the `${APP_URL}` bindable variable).
2. Validate the spec: `doctl apps spec validate .do/app.yaml`.
3. Create the app (`doctl apps create --spec .do/app.yaml`) or point the DO control panel at the
   repo. Set the **secret** env vars in the control panel — they are typed `SECRET` in the spec
   and are not stored in Git. App Platform retains their values across spec applies:
   - `SECRET_KEY` — generate a fresh, environment-specific value with `openssl rand -hex 32`
     (never reuse the staging key in production; see [SECRET_KEY lifecycle](#secret_key-lifecycle))
   - `AZURE_CLIENT_SECRET`, `ADMIN_EMAILS`, and (optional) `ANTHROPIC_API_KEY`
4. Register the App Platform URL's `/api/auth/callback` as a Redirect URI on the Azure app
   registration, and make sure it matches `AZURE_REDIRECT_URI` in the spec exactly.
5. Store a DO API token as the `PROD_DO_ACCESS_TOKEN` GitHub secret so
   [`.github/workflows/deploy-production.yml`](./.github/workflows/deploy-production.yml) can apply the spec on push.

**Migrating an existing (`create_all`-built) database:** the genesis migration reproduces the
`create_all` schema, so a DB that already has the tables must be marked as already-migrated
**once**, before the first migrate-job run, or `alembic upgrade head` fails on
"relation already exists":

```bash
# one-time, against the live DB (temporarily allow your IP on the DB firewall)
DATABASE_URL=<prod-db-url> alembic stamp head
```

A fresh/empty DB needs no stamp — `upgrade head` builds it from scratch.

### Production environment variables

These are set in `.do/app.yaml` (and the DO control panel for secrets), **not** in a `.env`
file. See the spec for the authoritative list and inline notes.

- `DATABASE_URL` — injected by the managed DB (`${db.DATABASE_URL}`); arrives with `?sslmode=require`
- `SECRET_KEY` _(secret)_ — JWT signing key
- `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` and `AZURE_CLIENT_SECRET` _(secret)_
- `AZURE_REDIRECT_URI=https://<app-url>/api/auth/callback` (must match the Azure registration exactly)
- `FRONTEND_URL=https://<app-url>` and `BACKEND_CORS_ORIGINS=https://<app-url>`
- `ADMIN_EMAILS` — emails granted Admin on first sign-in
- `ENABLE_DEV_LOGIN=false` (the test login stays off in production)
- `ANTHROPIC_API_KEY` _(secret)_ — optional, enables the AI Notetaker
- `VITE_API_BASE_URL=/api` — **build-time** on the static site (Vite inlines it into the bundle)

### Shipping updates

Deploys are **GitOps**, applied by CI — `deploy_on_push: false` is set on every component so App
Platform never deploys on its own (that would double-deploy and, more importantly, would ignore
the repo spec). CI is the single deploy path:

| Branch    | Workflow                                                             | App                 | Spec               |
| --------- | -------------------------------------------------------------------- | ------------------- | ------------------ |
| `main`    | [`deploy-production.yml`](./.github/workflows/deploy-production.yml) | `production` (prod) | `.do/app.yaml`     |
| `develop` | [`deploy-staging.yml`](./.github/workflows/deploy-staging.yml)       | `staging` (UAT)     | `.do/staging.yaml` |

Each workflow runs `digitalocean/app_action/deploy@v2`, which applies **both** the spec and the
code together — so a field that drifts from reality in the committed spec gets pushed onto the
live app on the next deploy. Keep the spec mirroring the deployed app. Branch flow:
PRs → `develop` (staging/UAT) → `main` (prod). Managed Postgres data persists across deploys and
is backed up by the platform when `production: true` is set on the DB.

### Staging / UAT environment

A persistent **`staging`** app (spec: [`.do/staging.yaml`](./.do/staging.yaml)) deployed from the
`develop` branch gives a stable URL for user-acceptance testing before anything reaches prod. It
mirrors the prod spec with two deliberate differences: its database is a **dev-tier** DB
(`production: false` — cheaper, no HA/backups, adequate for throwaway test data), and it carries
its own secrets. It is _persistent_ (not an ephemeral per-PR preview) precisely so its callback
URL is stable enough to register in Azure once.

Bringing staging up (one-time):

1. **Create the app once, manually.** `app_action/deploy@v2` only _updates_ an existing app — it
   fails with `app "staging" does not exist` on a first run — so bootstrap it with `doctl` (then
   the workflow takes over):
   ```bash
   doctl apps create --spec .do/staging.yaml   # provisions the app + its dev DB
   ```
   This also runs the migrate job, building the schema (`alembic upgrade head` on the empty DB —
   no stamp needed).
2. In the `staging` app's DO control panel, set the `SECRET` env vars. The backend stays
   unhealthy until `SECRET_KEY` and `AZURE_CLIENT_SECRET` are set (both are required, no default):
   - `SECRET_KEY` — a **fresh** `openssl rand -hex 32`, **distinct from prod**
   - `AZURE_CLIENT_SECRET`, `ADMIN_EMAILS`
3. Register staging's stable `${APP_URL}/api/auth/callback` as a Redirect URI on the Azure app
   registration (do this once — the reason for a persistent app over ephemeral previews, whose
   unpredictable URLs can't be pre-registered).
4. Seed the staging dev DB with test data (e.g. `pg_dump --data-only` from local dev).
5. Ensure the `UAT_DO_ACCESS_TOKEN` GitHub secret exists (used by `deploy-staging.yml`).

Thereafter, every push to `develop` redeploys staging; the dev DB and its secrets persist across
deploys.

### SECRET_KEY lifecycle

`SECRET_KEY` signs the app's JWTs. Treat it like a password:

- **Generate once per environment** with `openssl rand -hex 32` and store it as a `SECRET` env
  var in that app's DO control panel. It is not committed and is retained across spec applies.
- **Use a different key per environment** (prod ≠ staging ≠ local) so a leaked staging key can't
  forge prod tokens.
- **Rotate** only if you suspect it leaked (or on a periodic policy). Rotating invalidates every
  outstanding JWT, so all users must log in again — a deliberate, low-frequency action, not part
  of routine deploys.

### Sizing & scaling

The backend runs at `apps-s-1vcpu-0.5gb` (`instance_count: 1`) and the managed DB at the HA tier
(`production: true` — automated daily backups + point-in-time recovery). Scale by editing
`.do/app.yaml`: bump `instance_size_slug`/`instance_count` for the backend. The frontend is a
static site served from the edge, so it needs no sizing.

### Outstanding before production hardening

Kept simple for the pilot; do these before real users depend on the system:

- **Tighten CORS.** `backend/app/main.py` allows `methods=["*"]`/`headers=["*"]`; scope these down
  (same-origin on App Platform means CORS is barely exercised, but don't ship `*` long-term).
- **Expand test coverage.** Backend (`pytest`) and frontend (Vitest) suites plus GitHub Actions
  CI are in place (see [Testing](#testing)); broaden coverage (auth, assessments, stage
  transitions) as features settle.

## Testing

The backend has a `pytest` suite (in `backend/tests/`) that runs against an in-memory SQLite
database — no Postgres needed. The frontend has a [Vitest](https://vitest.dev/) +
React Testing Library suite (co-located in `__tests__/` folders under `frontend/src/`).
**GitHub Actions runs jobs on every push and pull request** — backend tests,
frontend build, frontend tests and db migration tests (`.github/workflows/ci.yml`) — so regressions are
caught before deploy.

### Running the backend tests

```bash
# In a container (parity with prod — recommended):
docker compose run --rm backend pytest

# Or build the dedicated test stage (this is exactly what CI runs):
docker build --target test ./backend

# Or on the host, in a virtualenv:
cd backend && pip install -r requirements-dev.txt && pytest
```

Test-only dependencies live in `backend/requirements-dev.txt` (kept out of the production image,
which installs `requirements.txt` only).

### Backend smoke test

With the stack running:

```bash
# Health check should return {"status": "ok", "app": "Rozetta PMS"}
curl http://localhost:8000/api/health

# Explore and exercise endpoints interactively
open http://localhost:8000/docs
```

### Running the frontend tests

```bash
# On the host:
docker build --target test ./frontend
```

### Frontend build check

A successful production build is a good sanity check that the app compiles:

```bash
cd frontend
npm run build
npm run preview      # serve the built app to spot-check it
```

### Adding tests

- **Backend** — add more [`pytest`](https://docs.pytest.org/) modules under `backend/tests/` (using FastAPI's `TestClient`); the fixtures in `tests/conftest.py` give you a clean SQLite DB and an authenticated admin client. New test-only deps go in `requirements-dev.txt`.
- **Frontend** — add more [Vitest](https://vitest.dev/) + React Testing Library specs in `__tests__/` folders next to the code they cover (the existing suites under `frontend/src/` are good templates). The `test` script and test deps are already wired up in `frontend/package.json`.

## License

Internal — Rozetta Institute. All rights reserved.
