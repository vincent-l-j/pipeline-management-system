# Architecture — Dev vs Production

Rozetta PMS is a single-page React app backed by a FastAPI service and PostgreSQL,
with Microsoft Azure AD for auth and the Anthropic Claude API powering the AI Notetaker.
The **same application code** runs in both environments — only the way it's built, served,
and wired together differs.

> For diagram form, see the [C4 diagrams](./c4/README.md) (Context, Container, Component, and
> the dev/prod deployment views).

| Concern | Development | Production |
|---------|-------------|------------|
| Orchestration | `docker-compose.yml` (local) | DigitalOcean App Platform (`.do/app.yaml`) |
| Frontend | Vite dev server (hot reload) | Static site (buildpack: `npm run build` → `dist/`, served from the edge) |
| Backend | uvicorn `--reload`, `backend/Dockerfile` target `dev` | uvicorn (no reload), `backend/Dockerfile` final stage `prod` |
| Database | `postgres:16` container + `pgdata` volume | Managed PostgreSQL 16 (`DATABASE_URL` injected) |
| `/api` routing | Vite proxy → `backend:8000` | Same-origin route (`/api` → backend service) |
| TLS | none (plain HTTP) | Terminated by App Platform |
| Dev login | enabled (`ENABLE_DEV_LOGIN=true`) | disabled; `dev.py` route stripped from the `prod` image |
| Config source | `.env` file | `.do/app.yaml` + DO control panel (secrets) |
| Deploy | `docker compose up --build` | `git push` to `main` (`deploy_on_push: true`) |

---

## Development

Three containers defined in `docker-compose.yml`, all source-mounted for hot reload.

```
                         http://localhost:5173
  Browser ──────────────────────┐
                                 ▼
                    ┌──────────────────────────┐
                    │ frontend (Vite dev)  :5173│
                    │  proxies /api  ───────────┼──┐
                    └──────────────────────────┘  │
                                                   ▼
                    ┌──────────────────────────┐
                    │ backend (uvicorn --reload)│  :8000
                    │  FastAPI app              │
                    └──────────┬───────────────┘
                               ▼
                    ┌──────────────────────────┐
                    │ db (postgres:16)     :5432│
                    │  volume: pgdata           │
                    └──────────────────────────┘

  External (optional): Azure AD · Anthropic Claude API
```

- **Frontend** — Vite dev server on `5173` with hot module reload; the source tree is
  bind-mounted. `/api` requests are proxied to `backend:8000` (see `frontend/vite.config.js`),
  so the browser only ever talks to `5173`.
- **Backend** — `backend/Dockerfile` target `dev`: installs `requirements-dev.txt` (test
  tooling), runs `uvicorn ... --reload`, and includes the dev-only routes (`dev.py`). On
  startup it creates tables via `Base.metadata.create_all` — no migration step needed for a
  first run.
- **Database** — stock `postgres:16` with a named `pgdata` volume. Credentials come from `.env`.
- **Auth** — the **Dev Login (Admin)** button is enabled (`ENABLE_DEV_LOGIN=true` /
  `VITE_ENABLE_DEV_LOGIN=true`) so you can sign in without Azure AD configured.
- **Config** — everything is read from `.env` (copy from `.env.example`).

Start it with `docker compose up --build`. Frontend on `:5173`, API on `:8000/api`,
Swagger on `:8000/docs`.

---

## Production

DigitalOcean App Platform, declared as code in `.do/app.yaml`. Fully managed and
push-to-deploy — there is no server to provision, no Docker Compose, and no reverse proxy
to run yourself. Three platform primitives:

```
                    https://<app-url>   (HTTPS terminated by App Platform)
  Browser ──────────────────────┐
                                 ▼
                    ┌──────────────────────────────────┐
                    │       App Platform ingress        │
                    │  /      → static site (frontend)  │
                    │  /api   → backend service         │
                    └───────┬───────────────────┬───────┘
                            ▼                   ▼
              ┌───────────────────┐   ┌────────────────────────┐
              │ frontend          │   │ backend (FastAPI)       │
              │ static SPA (dist) │   │ Dockerfile stage: prod  │
              │ served from edge  │   └───────────┬────────────┘
              └───────────────────┘               ▼
                                        ┌────────────────────────┐
                                        │ Managed PostgreSQL 16   │
                                        │ DATABASE_URL injected   │
                                        └────────────────────────┘

  External: Azure AD (login) · Anthropic Claude API (AI Notetaker)
```

- **Frontend (static site)** — App Platform's Node buildpack runs `npm run build` and serves
  `dist/` from the edge at `/`. SPA deep links fall back to `index.html`
  (`catchall_document`). `VITE_API_BASE_URL=/api` is inlined at **build time**. The dev-login
  button is absent because `VITE_ENABLE_DEV_LOGIN` is unset, so it's dead-code-eliminated.
  > A container-based alternative exists — `frontend/Dockerfile` target `prod` builds the SPA
  > then serves it with `nginx:alpine` (`frontend/nginx.conf`, SPA-fallback routing) — but the
  > canonical deploy uses the buildpack static site above.
- **Backend (service)** — built from `backend/Dockerfile`; App Platform builds the **final
  stage** (`prod`), which carries runtime deps only (no test tooling) and removes `dev.py`.
  `run_command` overrides the image CMD to run uvicorn without `--reload`. Routed at `/api`
  (`preserve_path_prefix: true`), with a health check at `/health`.
- **Database (managed)** — managed PostgreSQL 16; `DATABASE_URL` is injected by the platform
  (arrives with `?sslmode=require`). No `db` container in production. Currently the dev-grade
  tier (`production: false` — no HA / automated backups); flip to `true` before real data lands.
- **Same origin** — the SPA and API share one origin, so `/api` calls need no CORS and the
  `localStorage` JWT travels normally. App Platform terminates HTTPS.
- **Config** — non-secret values live in `.do/app.yaml`; secrets (`SECRET_KEY`,
  `AZURE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`) are set in the DO control panel.
- **Deploy** — both the service and the static site set `deploy_on_push: true`, so merging to
  `main` triggers an automatic rebuild and deploy. (Note: App Platform builds `prod` directly
  and does **not** run the `test` stage — tests gate at the CI / merge layer; see below.)

---

## Build stages & where tests run

Both Dockerfiles are multi-stage. The `test` stages are **not** in the prod image's lineage —
they're a separate target that CI builds explicitly.

- **`backend/Dockerfile`** — `base → dev → test` (sibling) and `base → prod`. `prod` builds
  from `base` (the Python runtime is what it serves), staying lean with no dev/test tooling.
- **`frontend/Dockerfile`** — `base → {dev, test, build}`; `build → prod`. `prod` is
  `nginx:alpine` and copies only `dist/` from `build`, because the frontend's runtime is static
  files, not Node — no need to ship `node_modules` or source.

CI (`.github/workflows/ci.yml`) runs `docker build --target test` (backend + frontend) and
`--target build` (frontend) on every push and PR, so a red test fails the build there.
Production builds don't re-run tests — protect `main` with required CI checks so untested code
never reaches the branch App Platform deploys from.

---

## Cross-cutting

- **Auth** — Microsoft Azure AD via MSAL; the backend exchanges the auth code for a token,
  issues a JWT, and redirects to `FRONTEND_URL`. Only `@rozettainstitute.com` accounts are
  accepted; `ADMIN_EMAILS` are granted Admin on first sign-in. Roles: Admin / Assessor / Viewer.
- **AI Notetaker** — `backend/app/services/ai_notetaker.py` calls the Anthropic Claude API to
  turn raw meeting notes into structured records, with a basic text-parser fallback when
  `ANTHROPIC_API_KEY` is unset.
- **Schema** — tables are auto-created at startup via `Base.metadata.create_all`. Alembic is
  configured for managed migrations; the `PRE_DEPLOY` job in `.do/app.yaml` is the place to wire
  `alembic upgrade head` once you move off `create_all`.
