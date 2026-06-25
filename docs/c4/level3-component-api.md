# C4 Level 3 — Components (API Application)

Zooms into the **API Application** container (`backend/app/`). Other containers are shown as
context only.

```mermaid
C4Component
    title Component diagram — API Application

    Container(spa, "Single-Page App", "React, Vite", "Browser client")
    ContainerDb(db, "Database", "PostgreSQL 16", "")
    System_Ext(azure, "Microsoft Azure AD", "Identity provider")
    System_Ext(claude, "Anthropic Claude API", "LLM")

    Container_Boundary(api, "API Application") {
        Component(routes, "API Routes", "FastAPI routers (api/routes/)", "pitches, meetings, assessments, organisations, contacts, users, auth, search, reports, timeline (+ dev in dev only)")
        Component(security, "Security", "core/security.py, MSAL, JWT", "Azure AD code exchange, JWT issue/verify, current-user dependency, role checks")
        Component(notetaker, "AI Notetaker service", "services/ai_notetaker.py", "Turns raw notes into structured records; basic-parser fallback")
        Component(persistence, "Models & Schemas", "SQLAlchemy models + Pydantic schemas", "ORM entities and request/response validation")
        Component(dbsession, "Database session", "core/database.py, SQLAlchemy", "Engine + session; create_all on startup")
        Component(config, "Config", "core/config.py, pydantic-settings", "Env-driven settings (DB URL, Azure, secrets, flags)")
    }

    Rel(spa, routes, "Calls", "JSON / HTTPS")
    Rel(routes, security, "Authorises requests via")
    Rel(routes, persistence, "Maps to / validates with")
    Rel(routes, dbsession, "Queries via")
    Rel(dbsession, db, "Connects to", "asyncpg / SSL")
    Rel(routes, notetaker, "Delegates note parsing to")
    Rel(notetaker, claude, "Calls", "HTTPS / JSON")
    Rel(security, azure, "Exchanges OAuth code / validates login", "MSAL")
    Rel(config, dbsession, "Configures")
    Rel(config, security, "Configures")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

**Notes**

- `Models & Schemas` collapses two code-level packages (`models/` SQLAlchemy + `schemas/`
  Pydantic) into one component to keep the diagram at component altitude.
- The `dev` routes component exists only in the dev image; the `prod` Docker stage removes
  `dev.py`.
- Tables are created on startup via `Base.metadata.create_all` (Alembic available for managed
  migrations).
