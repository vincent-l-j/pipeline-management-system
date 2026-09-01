# Architecture — Dev vs Production

Rozetta PMS is a single-page React app backed by a FastAPI service and PostgreSQL,
with Microsoft Azure AD for auth and the Anthropic Claude API powering the AI Notetaker.
The **same application code** runs in both environments — only the way it's built, served,
and wired together differs.

| Concern        | Development                                           | Production                                                                                           |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Orchestration  | `docker-compose.yml` (local)                          | DigitalOcean App Platform (`.do/app.yaml`)                                                           |
| Frontend       | Vite dev server (hot reload)                          | Static site (buildpack: `npm run build` → `dist/`, served from the edge)                             |
| Backend        | uvicorn `--reload`, `backend/Dockerfile` target `dev` | uvicorn (no reload), `backend/Dockerfile` final stage `prod`                                         |
| Database       | `postgres:16` container + `pgdata` volume             | Managed PostgreSQL 16 (`DATABASE_URL` injected)                                                      |
| `/api` routing | Vite proxy → `backend:8000`                           | Same-origin route (`/api` → backend service)                                                         |
| TLS            | none (plain HTTP)                                     | Terminated by App Platform                                                                           |
| Dev login      | enabled (`ENABLE_DEV_LOGIN=true`)                     | disabled; `dev.py` route stripped from the `prod` image                                              |
| Logging        | JSON to stdout, `docker compose logs`                 | JSON to stdout, collected by App Platform's runtime logs                                             |
| Config source  | `.env` file                                           | `.do/app.yaml` + DO control panel (secrets)                                                          |
| Deploy         | `docker compose up --build`                           | CI GitOps: push to `main` → `deploy-production.yml` applies `.do/app.yaml` (`deploy_on_push: false`) |

---

## Development

Three containers defined in `docker-compose.yml`, all source-mounted for hot reload,
all on the `appnet` compose network.

That file is the single definition of the stack. `.devcontainer/compose.yaml`
`include:`s it rather than restating it, adds the `app` dev container as a fourth
service, and redeclares `appnet` as `internal: true` — which removes the stack's
internet access when Claude Code is present, since a firewall inside `app` cannot
restrain a sibling container that shares its bind mounts. See
`.devcontainer/README.md`.

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
  tooling), runs `uvicorn ... --reload`, and includes the dev-only routes (`dev.py`). The app
  does **not** create tables on startup and compose runs no migrate step, so apply the schema
  to the dev DB by hand — `docker compose run --rm backend alembic upgrade head` — on first
  bring-up and after any `docker compose down -v`.
- **Database** — stock `postgres:16` with a named `pgdata` volume. Credentials come from `.env`.
- **Auth** — the **Dev Login (Admin)** button is enabled (`ENABLE_DEV_LOGIN=true` /
  `VITE_ENABLE_DEV_LOGIN=true`) so you can sign in without Azure AD configured.
- **Config** — everything is read from `.env` (copy from `.env.example`).

Start it with `docker compose up --build`, then apply the schema once with
`docker compose run --rm backend alembic upgrade head` (see **Backend** above — nothing
creates tables automatically). Frontend on `:5173`, API on `:8000/api`, Swagger on `:8000/docs`.

---

## Production

DigitalOcean App Platform, declared as code in `.do/app.yaml` and deployed via CI (GitOps —
see **Deploy** below). Fully managed — there is no server to provision, no Docker Compose, and
no reverse proxy to run yourself. A parallel `staging` (UAT) app on the `develop` branch mirrors
this from `.do/staging.yaml`. Platform primitives:

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
  (`preserve_path_prefix: true`). Two probes, deliberately split: **liveness**
  (`/api/health`) answers "is this process up" and never touches the database — it is what
  App Platform polls (`health_check.http_path`) and what restarts a failing instance, so
  making it depend on Postgres would turn a brief database blip into a crash loop across
  healthy instances. **Readiness** (`/api/health/ready`) does check the database and returns
  503 when it is unreachable, reporting the failing dependency and `APP_VERSION` in the body;
  it is for operators and external monitors and is deliberately **not** wired to App
  Platform's restart gate. `APP_VERSION` is a hand-bumped marker set per environment in
  `.do/*.yaml`, not a git SHA — App Platform exposes no bindable commit hash.
- **Migrate job (`PRE_DEPLOY`)** — a short-lived job runs `alembic upgrade head` before each
  release, so schema changes ship atomically with their code. The app does **not** create tables
  on startup. The job needs only `DATABASE_URL` (`env.py` reads it from the environment, not the
  app `Settings`), so it runs without the app secrets.
- **Database (managed)** — managed PostgreSQL 16; `DATABASE_URL` is injected by the platform
  (arrives with `?sslmode=require`). No `db` container in production. Prod is the HA tier
  (`production: true` — automated daily backups + PITR); staging uses a dev-tier DB.
- **Same origin** — the SPA and API share one origin, so `/api` calls need no CORS and the
  `localStorage` JWT travels normally. App Platform terminates HTTPS.
- **Config** — non-secret values live in `.do/app.yaml`; secrets (`SECRET_KEY`,
  `AZURE_CLIENT_SECRET`, `ADMIN_EMAILS`, `ANTHROPIC_API_KEY`) are set in the DO control panel.
  `SECRET_KEY` is generated per environment with `openssl rand -hex 32`.
- **Deploy (GitOps)** — every component sets `deploy_on_push: false`; CI is the single deploy
  path. Push to `main` → `deploy-production.yml` applies `.do/app.yaml` to the `production` app; push to
  `develop` → `deploy-staging.yml` applies `.do/staging.yaml` to the persistent `staging` (UAT)
  app. `app_action/deploy@v2` applies spec **and** code together, so the committed spec must
  mirror the live app. (App Platform builds `prod` directly and does **not** run the `test`
  stage — tests gate at the CI / merge layer; see below.)

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
never reaches the branch App Platform deploys from. CI also runs database migrations tests too.

---

## Cross-cutting

- **Auth** — Microsoft Azure AD via MSAL; the backend exchanges the auth code for a token,
  issues a JWT, and redirects to `FRONTEND_URL`. Only `@rozettainstitute.com` accounts are
  accepted; `ADMIN_EMAILS` are granted Admin on first sign-in. Roles: Admin / Assessor / Viewer.
- **AI Notetaker** — `backend/app/services/ai_notetaker.py` calls the Anthropic Claude API to
  turn raw meeting notes into structured records, with a basic text-parser fallback when
  `ANTHROPIC_API_KEY` is unset.
- **Observability** — `backend/app/core/logging.py` configures the process at import time so
  every record, including uvicorn's own startup/shutdown lines, is emitted to stdout as a single
  line of JSON (timestamp, level, logger, service, environment, message, plus any `extra=`
  fields). `LOG_LEVEL` and `ENVIRONMENT` are settings, so a container can be restarted at
  `DEBUG` without a code change. Nothing writes log files — the platform collects stdout.
  `backend/app/core/request_context.py` correlates that stream: it is the outermost middleware,
  it gives each request an id (reusing a safe inbound `X-Request-ID`, replacing an unsafe one),
  returns it on every response — CORS exposes the header so the browser can read it — and stamps
  it on every record the request produces, including the one access record it writes per request
  (method, path without the query string, status, duration, and the acting user when the request
  is authenticated). uvicorn's own access log is muted at every level in favour of that record;
  successful health probes are logged at `DEBUG` so routine polling doesn't bury real signal. The
  same module handles anything that reaches the server unhandled: the exception and its traceback
  are logged at `ERROR` with the request id — once, the uncorrelated copy uvicorn re-logs after
  the handler runs being filtered back out — and the caller gets
  `500 {"detail": "Internal server error", "request_id": "..."}` plus the id on the header —
  a value a user can quote that locates the traceback, with no exception message, stack frame
  or file path in the response. Expected errors (`HTTPException`) are untouched and keep their
  `{"detail": ...}` body. Browser failures never reach that stream on their own — those logs are
  this process's stdout, not the tab's — so `backend/app/api/routes/client_errors.py` provides the
  hop: any signed-in user may `POST /api/client-errors` with the message, page URL and stacks, and
  the backend records it at `ERROR` and returns `202` with the correlating request id. The reported
  strings travel as `extra=` fields only, so a crafted stack is escaped into one line rather than
  forging a second record, and the identity on the record comes from the credential rather than the
  body. The SPA closes the loop: `frontend/src/services/api.ts` records the `X-Request-ID` off every
  response (fulfilled or rejected) and `frontend/src/components/ErrorBoundary.tsx`, mounted in
  `main.tsx` above the router and `AuthProvider`, catches an uncaught render error, posts the report
  through the shared client, and shows a fallback whose reference is the id the `202` handed back —
  falling back to the last `X-Request-ID` only when the report produced none. The report is
  fire-and-forget — it never throws, never retries, ignores a second report while one is in flight,
  and a `401` on it is exempt from the interceptor's redirect to `/login`, so a failed report cannot
  log the user out. **The hop is best-effort, so a browser failure does not always reach the
  stream**: the endpoint is authenticated, so a crash on the login page before a token exists is
  rejected and never recorded, as is one during a network outage or a report dropped in flight by
  the reload that follows. The fallback therefore states the reporting outcome only once it is
  known — reporting, reported with the reference, or could not be reported and here is who to tell —
  and offers a sign-out action, because clearing the stored session is the only escape from a crash
  caused by a corrupted one; reloading and returning to the dashboard both re-run it.
- **Schema** — owned by Alembic (`backend/alembic/`). The `PRE_DEPLOY` `migrate` job runs
  `alembic upgrade head` before each release; the app never creates tables on startup. See
  `sop/db-change.md` for the schema-change runbook.
