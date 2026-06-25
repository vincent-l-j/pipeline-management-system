# C4 Deployment — Production (DigitalOcean App Platform)

How the containers run in production (`.do/app.yaml`). Fully managed PaaS: no server, no
Compose, no self-run reverse proxy.

```mermaid
C4Deployment
    title Deployment (Production) — DigitalOcean App Platform

    Person(staff, "Rozetta staff member", "Browser")

    Deployment_Node(do, "DigitalOcean App Platform", "Managed PaaS, HTTPS terminated at the edge") {
        Deployment_Node(edge, "Static site (edge)", "Node buildpack") {
            Container(spa, "SPA bundle", "React build → dist/", "Served at /; SPA fallback to index.html")
        }
        Deployment_Node(svc, "Backend service", "Docker (Dockerfile target: prod)") {
            Container(api, "uvicorn", "FastAPI, run_command", "Routed at /api; health check /health; dev routes stripped")
        }
        Deployment_Node(mdb, "Managed database", "PostgreSQL 16") {
            ContainerDb(db, "PostgreSQL", "Managed PG", "DATABASE_URL injected; sslmode=require")
        }
    }

    System_Ext(azure, "Microsoft Azure AD", "Identity provider")
    System_Ext(claude, "Anthropic Claude API", "LLM")

    Rel(staff, spa, "Loads app", "HTTPS")
    Rel(spa, api, "Calls /api (same origin)", "HTTPS / JSON")
    Rel(api, db, "Reads & writes", "asyncpg / SSL")
    Rel(api, azure, "Authenticates users", "MSAL / OAuth")
    Rel(api, claude, "Parses meeting notes", "HTTPS / JSON")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

**Notes**

- SPA and API share one origin → no CORS, JWT travels normally; App Platform terminates HTTPS.
- Frontend is a buildpack **static site** (not the `frontend/Dockerfile`); backend is the
  Dockerfile's final `prod` stage with its CMD overridden by `run_command`.
- Deploys are push-to-`main` (`deploy_on_push: true`). The DB is currently the dev-grade tier
  (`production: false`); flip to `true` before real data lands.
