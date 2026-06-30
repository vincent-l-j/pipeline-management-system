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

| Layer    | Technology |
|----------|------------|
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic, Alembic |
| Database | PostgreSQL 16 |
| Auth     | Microsoft Azure AD (MSAL) + JWT, with a dev-login fallback |
| AI       | Anthropic Claude API (AI Notetaker) |
| Frontend | React 18, Vite 6, React Router 6, Tailwind CSS, axios, @hello-pangea/dnd |
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

The frontend proxies `/api` requests to the backend (see `frontend/vite.config.js`). On startup the backend auto-creates database tables via `Base.metadata.create_all` — no migration step is required for a first run.

For a fuller breakdown of how the dev and production stacks differ (containers, routing, build stages, and where tests run), see [`docs/architecture.md`](./docs/architecture.md), or the [C4 diagrams](./docs/c4/README.md) for a visual view.

## Quick start (Docker — recommended)

Requires **Docker** and **Docker Compose**.

```bash
# 1. Create your environment file and edit the secrets
cp .env.example .env
#    At minimum, set a strong POSTGRES_PASSWORD and SECRET_KEY.
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

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Yes | Postgres credentials used by the `db` service |
| `DATABASE_URL` | Yes | SQLAlchemy connection string (defaults to the `db` service) |
| `SECRET_KEY` | Yes | Secret used to sign JWTs — set a long random string |
| `BACKEND_CORS_ORIGINS` | Yes | Comma-separated allowed origins (e.g. `http://localhost:5173`) |
| `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID` | Optional | Microsoft OAuth (omit to use Dev Login) |
| `ANTHROPIC_API_KEY` | Optional | Enables AI note parsing; without it, a basic text parser is used |

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

### Database migrations (optional)

Tables are created automatically on backend startup. Alembic is configured (`backend/alembic.ini`) if you prefer managed migrations:

```bash
cd backend
alembic revision --autogenerate -m "your message"
alembic upgrade head
```

## Production deployment

Production runs on **DigitalOcean App Platform**, declared as code in
[`.do/app.yaml`](./.do/app.yaml). It is a fully managed, push-to-deploy setup — there is no
server to provision, no Docker Compose, and no reverse proxy to run yourself. The spec defines
three things:

| Component | How it's deployed |
|-----------|-------------------|
| **Backend** (FastAPI) | A *service* built from `backend/Dockerfile` (App Platform builds the final `prod` stage and overrides its CMD via `run_command`). Routed at `/api`, internal health check at `/health`. |
| **Frontend** (React SPA) | A *static site* built with App Platform's Node buildpack (`npm run build` → `dist/`), served from the edge at `/`. SPA deep links fall back to `index.html`. Same origin as the backend, so `/api` calls need no CORS. |
| **Database** (PostgreSQL 16) | A *managed database* (`databases:` block). `DATABASE_URL` is injected automatically — no `db` container in production. |

Because the SPA and API share one origin, there is no separate domain juggling and no TLS to
manage (App Platform terminates HTTPS for you), and the localStorage JWT travels normally.

### First deploy

1. Review `.do/app.yaml` and confirm the GitHub repo, Azure IDs, and `ADMIN_EMAILS` match your
   environment (the app URL resolves automatically via the `${APP_URL}` bindable variable).
2. Validate the spec: `doctl apps spec validate .do/app.yaml`.
3. Create the app (`doctl apps create --spec .do/app.yaml`) or point the DO control panel at the
   repo. Set the **secret** env vars (`SECRET_KEY`, `AZURE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`) in
   the control panel — they are typed `SECRET` in the spec and are not stored in Git.
4. Register the App Platform URL's `/api/auth/callback` as the Redirect URI on the Azure app
   registration, and make sure it matches `AZURE_REDIRECT_URI` in the spec exactly.

### Production environment variables

These are set in `.do/app.yaml` (and the DO control panel for secrets), **not** in a `.env`
file. See the spec for the authoritative list and inline notes.

- `DATABASE_URL` — injected by the managed DB (`${db.DATABASE_URL}`); arrives with `?sslmode=require`
- `SECRET_KEY` *(secret)* — JWT signing key
- `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` and `AZURE_CLIENT_SECRET` *(secret)*
- `AZURE_REDIRECT_URI=https://<app-url>/api/auth/callback` (must match the Azure registration exactly)
- `FRONTEND_URL=https://<app-url>` and `BACKEND_CORS_ORIGINS=https://<app-url>`
- `ADMIN_EMAILS` — emails granted Admin on first sign-in
- `ENABLE_DEV_LOGIN=false` (the test login stays off in production)
- `ANTHROPIC_API_KEY` *(secret)* — optional, enables the AI Notetaker
- `VITE_API_BASE_URL=/api` — **build-time** on the static site (Vite inlines it into the bundle)

### Shipping updates

Both the backend service and the static site set `deploy_on_push: true`, so **merging to `main`
triggers an automatic rebuild and deploy** — there is no `deploy.sh` step. Managed Postgres data
persists across deploys and is backed up by the platform when `production: true` is set on the DB.

### Sizing & scaling

The backend runs at `apps-s-1vcpu-1gb` (`instance_count: 1`) and the managed DB at the dev-grade
tier (`production: false` — no HA or automated backups). Both scale by editing `.do/app.yaml`:
bump `instance_size_slug`/`instance_count` for the backend, and flip the DB to `production: true`
before real data lands. The frontend is a static site served from the edge, so it needs no sizing.

### Outstanding before production hardening

Kept simple for the pilot; do these before real users depend on the system:

- **Promote the database.** Flip `production: false` → `true` on the managed DB in `.do/app.yaml`
  for HA and automated daily backups + point-in-time recovery before real data lands.
- **Wire up migrations.** The app currently builds tables via `Base.metadata.create_all()` at
  startup, which works for the first deploy but won't apply later schema changes. Uncomment the
  `PRE_DEPLOY` Alembic `migrate` job in `.do/app.yaml` and remove `create_all()` from startup.
- **Fail loud on missing config.** `FRONTEND_URL` (and other prod-critical settings) default to
  `localhost` in `config.py`; consider removing the defaults so an unset value errors at startup
  instead of silently breaking the login redirect.
- **Tighten CORS.** `backend/app/main.py` allows `methods=["*"]`/`headers=["*"]`; scope these down
  (same-origin on App Platform means CORS is barely exercised, but don't ship `*` long-term).
- **Expand test coverage.** Backend (`pytest`) and frontend (Vitest) suites plus GitHub Actions
  CI are in place (see [Testing](#testing)); broaden coverage (auth, assessments, stage
  transitions) as features settle.

## Testing

The backend has a `pytest` suite (in `backend/tests/`) that runs against an in-memory SQLite
database — no Postgres needed. The frontend has a [Vitest](https://vitest.dev/) +
React Testing Library suite (co-located in `__tests__/` folders under `frontend/src/`).
**GitHub Actions runs three jobs on every push and pull request** — backend tests,
frontend build, and frontend tests (`.github/workflows/ci.yml`) — so regressions are
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
