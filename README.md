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
| Infra    | Docker Compose |

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

The repo ships a production stack separate from the dev one: **Postgres + FastAPI + Caddy**,
where Caddy serves the built React SPA and reverse-proxies `/api` to the backend on a single
HTTPS domain (automatic Let's Encrypt certificates).

Relevant files:

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production stack — builds the `prod` target of each image, no source mounts, no dev reload, DB/backend internal-only, Caddy on 80/443 |
| `backend/Dockerfile` | Multi-stage (`base`→`dev`/`prod`); the `prod` stage strips the dev-login module |
| `frontend/Dockerfile` | Multi-stage (`base`→`dev`→`build`→`prod`); the `prod` stage serves the built SPA with Caddy |
| `frontend/Caddyfile` | HTTPS, SPA routing fallback, `/api` → backend proxy |
| `deploy.sh` | `git pull` + rebuild + restart — the redeploy command |

The dev and prod stacks share these Dockerfiles, selecting stages via `build.target`
(`dev` in `docker-compose.yml`, `prod` in `docker-compose.prod.yml`).

### Server sizing & scaling

The stack runs three small containers (Postgres + FastAPI + Caddy). At idle it's light; the
memory spike is **`npm run build`** during deploy, which can briefly exceed 1 GB.

| Tier | Fit |
|------|-----|
| **2 GB RAM / 2 vCPU** | Works for the pilot, but the build flirts with the ceiling — add a swap file (below) or build the image in CI instead of on the server. |
| **4 GB RAM / 2 vCPU** | Comfortable: build never OOMs, headroom for the org-wide rollout. Recommended. |

Pick a region near your users (latency), and prefer a provider with easy resize (DigitalOcean,
Vultr). **Scaling up later is a reboot, not a migration** — a RAM/CPU resize keeps the same IP,
disk, data, `.env`, Docker volumes, and TLS certs. (Disk grows are one-way; you only do a true
migration if you switch *providers*.) So start small and resize when the rollout demands it.

If you're on a 2 GB box and the build OOM-kills, add 2 GB of swap once:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab     # persist across reboots
```

### One-time server setup

On an Ubuntu cloud server (e.g. a DigitalOcean droplet, ≥2 GB RAM — the frontend build is
memory-hungry):

```bash
# Install Docker Engine + Compose plugin (no Docker Desktop / license needed)
curl -fsSL https://get.docker.com | sh

# Firewall: SSH + web only
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# Clone, configure, launch
git clone <your-private-repo> rozetta-pms && cd rozetta-pms
cp .env.example .env          # fill in the production checklist below
./deploy.sh
```

Point a DNS **A record** for your domain at the server's IP before launching, so Caddy can
issue a TLS certificate.

### Production `.env` checklist

- `POSTGRES_PASSWORD` — strong value; mirror it inside `DATABASE_URL` (host stays `db`)
- `SECRET_KEY` — `openssl rand -hex 32`
- `SITE_ADDRESS` — your bare domain, e.g. `pms.rozettainstitute.com`
- `FRONTEND_URL=https://<domain>` and `BACKEND_CORS_ORIGINS=https://<domain>`
- `AZURE_REDIRECT_URI=https://<domain>/api/auth/callback` (must match the Azure app registration exactly)
- `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID`
- `ADMIN_EMAILS` — your email, to be granted Admin on first sign-in
- `ENABLE_DEV_LOGIN=false` (keep the test login disabled in production)
- Optional: `ANTHROPIC_API_KEY`

### Shipping updates

Push to your Git remote, then on the server run `./deploy.sh`. Postgres data and TLS certs
persist across redeploys via named volumes.

### Outstanding before production hardening

Kept simple for the pilot; do these before real users depend on the system:

- **Off-server backups.** A daily `pg_dump` cron on the host (writing to `/root/backups`, not the
  `pgdata` volume) is the minimum, but that disk dies with the server. Add a `backup.sh` that
  uploads each dump to object storage (DigitalOcean Spaces / S3 / Backblaze B2 via `rclone`) and
  rotates local copies — or switch to DO Managed PostgreSQL (automated backups + PITR).
- **Fail loud on missing config.** `FRONTEND_URL` (and other prod-critical settings) default to
  `localhost` in `config.py`; consider removing the defaults so an unset value errors at startup
  instead of silently breaking the login redirect.
- **Tighten CORS.** `backend/app/main.py` allows `methods=["*"]`/`headers=["*"]`; scope these down
  (same-origin behind Caddy means CORS is barely exercised, but don't ship `*` long-term).
- **Expand test coverage.** A backend `pytest` suite and GitHub Actions CI are in place (see
  [Testing](#testing)); broaden coverage (auth, assessments, stage transitions) as features settle.

## Testing

The backend has a `pytest` suite (in `backend/tests/`) that runs against an in-memory SQLite
database — no Postgres needed. **GitHub Actions runs it on every push and pull request**
(`.github/workflows/ci.yml`), so regressions are caught before deploy.

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

### Frontend build check

A successful production build is a good sanity check that the app compiles:

```bash
cd frontend
npm run build
npm run preview      # serve the built app to spot-check it
```

### Adding tests

- **Backend** — add more [`pytest`](https://docs.pytest.org/) modules under `backend/tests/` (using FastAPI's `TestClient`); the fixtures in `tests/conftest.py` give you a clean SQLite DB and an authenticated admin client. New test-only deps go in `requirements-dev.txt`.
- **Frontend** — [Vitest](https://vitest.dev/) + React Testing Library pairs naturally with Vite. Add them as dev dependencies, then wire up a `"test": "vitest"` script in `frontend/package.json`.

## License

Internal — Rozetta Institute. All rights reserved.
