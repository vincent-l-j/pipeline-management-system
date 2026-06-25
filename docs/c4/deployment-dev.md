# C4 Deployment — Development (Docker Compose)

How the containers run locally (`docker-compose.yml`). All three services are source-mounted
for hot reload.

```mermaid
C4Deployment
    title Deployment (Development) — Docker Compose

    Deployment_Node(machine, "Developer machine", "Docker Compose") {
        Deployment_Node(fe, "frontend service", "node:24, port 5173") {
            Container(spa, "Vite dev server", "React, Vite", "Hot reload; proxies /api to backend")
        }
        Deployment_Node(be, "backend service", "python:3.12, port 8000") {
            Container(api, "uvicorn --reload", "FastAPI (Dockerfile target: dev)", "Dev routes present; dev-login enabled")
        }
        Deployment_Node(dbnode, "db service", "postgres:16, port 5432") {
            ContainerDb(db, "PostgreSQL", "PostgreSQL 16", "Named volume: pgdata")
        }
    }

    System_Ext(azure, "Microsoft Azure AD", "Optional in dev")
    System_Ext(claude, "Anthropic Claude API", "Optional in dev")

    Rel(spa, api, "Proxies /api", "HTTP")
    Rel(api, db, "Reads & writes", "SQLAlchemy")
    Rel(api, azure, "Authenticates (or Dev Login)", "OAuth")
    Rel(api, claude, "Parses notes (or fallback)", "HTTPS")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

**Notes**

- Plain HTTP, no TLS. Frontend on `:5173`, API on `:8000/api`, Swagger on `:8000/docs`.
- `ENABLE_DEV_LOGIN=true` (and `VITE_ENABLE_DEV_LOGIN=true`) enable the "Dev Login (Admin)"
  button, so Azure AD and the Claude key are both optional locally.
- Config comes from `.env`.
