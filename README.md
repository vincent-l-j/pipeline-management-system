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

### Production `.env` checklist

- `FRONTEND_URL=https://<domain>` and `BACKEND_CORS_ORIGINS=https://<domain>`
- `ADMIN_EMAILS` — your email, to be granted Admin on first sign-in
- `ENABLE_DEV_LOGIN=false` (keep the test login disabled in production)

## Testing

> **Note:** This project does not yet ship an automated test suite. The steps below cover the smoke tests and tooling available today, plus where new tests should go.

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

- **Backend** — [`pytest`](https://docs.pytest.org/) with FastAPI's `TestClient` is the recommended approach. Add a `backend/tests/` package and a `pytest` dependency to `requirements.txt`, then run with `pytest` from `backend/`.
- **Frontend** — [Vitest](https://vitest.dev/) + React Testing Library pairs naturally with Vite. Add them as dev dependencies, then wire up a `"test": "vitest"` script in `frontend/package.json`.

## License

Internal — Rozetta Institute. All rights reserved.
