# SOLID principles in this codebase

SOLID is five object/module design principles for keeping code changeable. They
are language-agnostic — they apply to the FastAPI backend and the React frontend
alike. This doc states each principle and shows how it already shows up (or should
show up) in Rozetta PMS, so new code stays consistent with the grain of the repo.

The backend and frontend best-practices docs describe the *conventions*; this doc
explains the *why* behind them.

---

## S — Single Responsibility Principle

*A module should have one reason to change.*

This is the backbone of the layering already in place:

- **Backend:** `routes/` handle HTTP (parse, authorize, shape responses),
  `models/` handle persistence, `schemas/` handle serialization/validation, and
  `services/` (e.g. `ai_notetaker.py`) hold logic that would otherwise bloat a
  route. A route that starts doing parsing or multi-step business logic should
  push that into a service.
- **Frontend:** pages/containers fetch and own state; presentational components
  render props (`KanbanBoard` owns the pitches and the move handler; `KanbanColumn`
  and `PitchCard` just render what they're given).
- **Commits:** the same principle at VCS scale — one coherent change per commit
  (see golden rule 10).

Smell: a function that changes for two unrelated reasons (e.g. "the delete rule
changed" *and* "the response fields changed") wants splitting.

## O — Open/Closed Principle

*Open for extension, closed for modification.*

Prefer adding data/implementations over editing existing branching logic:

- Pipeline stages, sources, funding pathways, and assessment criteria are **config
  and enums** (`PipelineStage`, `PIPELINE_STAGES`, `SOURCE_LABELS`,
  `AssessmentConfig.CRITERIA`). Adding a stage means adding an entry, not rewriting
  the board — the Kanban renders whatever is in `PIPELINE_STAGES`.
- Adding a resource means adding a new `APIRouter` and registering it in
  `main.py`; existing routers are untouched.
- `require_role(*roles)` is extended by passing different roles, not by editing the
  checker.

Smell: reaching into a `if source == 'referral' … elif …` ladder to add a case,
when a lookup map keyed by the enum value would let you just add a key.

## L — Liskov Substitution Principle

*Subtypes must be usable wherever the base type is expected — without surprises.*

- The clearest example here is the **database session**: routes depend on a
  SQLAlchemy `Session` from `get_db`, and the test suite substitutes a SQLite
  session for the Postgres one with no code change. That only works because both
  honour the same `Session` contract. (The corollary — SQLite *not* enforcing FKs
  — is exactly where substitution leaks, which is why integrity lives in app code;
  see the integration doc.)
- The three auth fixtures (`admin_client`, `assessor_client`, `viewer_client`) are
  substitutable `TestClient`s differing only in role, so the same test shape works
  across roles.

Smell: a "subtype" that throws or no-ops where the base type wouldn't (e.g. a
narrower schema that silently drops a field a caller relied on).

## I — Interface Segregation Principle

*Don't force a client to depend on things it doesn't use.*

This is the design rule behind **least-privilege responses**:

- The planned user directory (a minimal `id`/`display_name` schema, distinct from
  the full admin `UserOut` with email/role/status; see `features.json`) is a
  worked example: name-resolution callers get exactly the interface they need and
  nothing sensitive. Widening one shared schema to serve both would violate ISP
  *and* leak data. `UserOut` itself already applies ISP today.
- Components take only the props they use — `PitchCard` receives a `pitch` plus
  drag props, not the whole board's state.
- Depend on the narrowest dependency: use `get_current_user` when you only need
  identity; use `require_role(...)` when you need authorization — don't reach for
  more context than the handler uses.

Smell: a schema, prop bag, or dependency where callers consistently use only a
slice — split it.

## D — Dependency Inversion Principle

*Depend on abstractions, not concretions; wire the concretion in at the edge.*

- **Backend:** routes never construct a `SessionLocal()` or decode a JWT inline —
  they declare `Depends(get_db)` / `Depends(get_current_user)`. FastAPI injects the
  concrete implementation, and tests swap it via `app.dependency_overrides`. That
  substitution is the whole reason the suite can run without Postgres or real
  tokens.
- **Frontend:** components depend on the `api` abstraction (`services/api.js`), not
  on axios directly. Auth flows through the `useAuth()` hook, not `localStorage`
  reads scattered through components. Swapping transport or auth storage is then a
  one-file change.
- **Services:** the AI notetaker depends on "a way to parse notes" and falls back
  to a basic parser when the Claude client isn't configured — the caller doesn't
  care which implementation runs.

Smell: a component importing `axios`, or a route calling `SessionLocal()` /
reading env vars directly — that's depending on a concretion the edge should have
injected.

---

## Applying SOLID without over-engineering

SOLID serves changeability; it is not a mandate to add layers. For a small,
CRUD-shaped feature, a thin route + schemas is already SRP/DIP-compliant — don't
invent a service class with one caller just to "be SOLID". Reach for a new
abstraction when a **second** reason to change, a **second** implementation, or a
**second** consumer actually appears. Premature interfaces cost more than they
save.
