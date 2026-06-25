# C4 Level 2 — Containers

Zooms into the Rozetta PMS box: the runnable/deployable units and how they communicate.
This view is **topology-agnostic** — how each container is served differs between dev and prod
(see the [deployment views](./deployment-dev.md)), but the logical containers are the same.

```mermaid
C4Container
    title Container diagram — Rozetta PMS

    Person(staff, "Rozetta staff member", "Admin, Assessor or Viewer")

    System_Boundary(pms, "Rozetta PMS") {
        Container(spa, "Single-Page App", "React 18, Vite, React Router, Tailwind", "Pipeline board, pitch/meeting/assessment screens, dashboard, search, reports.")
        Container(api, "API Application", "Python 3.12, FastAPI, uvicorn", "REST API under /api: auth, CRUD, search, reports, AI Notetaker.")
        ContainerDb(db, "Database", "PostgreSQL 16", "Pitches, meetings, assessments, organisations, contacts, users, timeline.")
    }

    System_Ext(azure, "Microsoft Azure AD", "Identity provider")
    System_Ext(claude, "Anthropic Claude API", "LLM for note parsing")

    Rel(staff, spa, "Uses", "HTTPS")
    Rel(spa, api, "Calls", "JSON / HTTPS, path /api")
    Rel(api, db, "Reads & writes", "SQLAlchemy / asyncpg")
    Rel(api, azure, "Authenticates users", "MSAL / OAuth")
    Rel(api, claude, "Parses meeting notes", "HTTPS / JSON")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

**Notes**

- The SPA only ever talks to the API at `/api`. In dev this is the Vite proxy; in prod it's a
  same-origin route — either way the browser sees one origin.
- The backend issues a JWT after the Azure AD exchange; the SPA stores it in `localStorage` and
  sends it on each `/api` call.
