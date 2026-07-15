# Instance sheet: Rozetta PMS

Per-app values the DB SOPs plug into. The SOPs
([`db-bootstrap.md`](../db-bootstrap.md),
[`db-change.md`](../db-change.md)) are generic; this file is the app-specific part.
Keep it current — the SOPs trust it.

## Stack

Standard stack: FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL 16 + DigitalOcean App
Platform. No deviations.

## Configuration

**Configuration comes from `.env` in the repo root** — copy `.env.example` and customize
for your environment. See that file for all variables. Database credentials and URLs are
derived from `$POSTGRES_USER`, `$POSTGRES_PASSWORD`, and database names you choose.

## Environment: where and how to run SOP commands

**This host has no local `python`, `alembic`, `psql`, or `pg_dump`.** The whole
toolchain lives in the Docker images. So every DB/Alembic step in the SOPs runs
*inside a container*, launched with `docker compose` **from the repo root** (the
directory that contains `docker-compose.yml` — e.g. `.../pipeline-management-system/mission/`).
Do not `cd backend` on the host and run `alembic` — it isn't installed there.

**Prerequisite — create `.env` first, or every `docker compose` command fails.** The
`backend` service declares `env_file: - .env` in `docker-compose.yml`, and `.env` is
**gitignored** (only `.env.example` is committed). On a fresh clone the file is absent, so
compose aborts with `env file .../.env not found` *before any container starts* — this has
broken a run before. From the repo root:

```bash
[ -f .env ] || cp .env.example .env   # idempotent; safe to run every time
```

The committed `.env.example` already carries the local dev defaults the SOP commands rely
on (`POSTGRES_USER=rozetta`, `POSTGRES_PASSWORD=change_me_to_a_strong_password`,
`POSTGRES_DB=rozetta_pms`), which match the `db:5432` scratch-DB URLs above — so a plain
copy is enough for local bootstrap; no edits needed. (The `db` service itself falls back to
`${POSTGRES_USER:-rozetta}` defaults and would start without `.env`, but `backend` — where
every Alembic step runs — will not.)

Two wrapper patterns cover every command the SOPs show:

- **`psql` / database admin** → run in the already-running `db` container:
  ```bash
  docker compose exec db psql -U rozetta -d <database> -c "<SQL>"
  ```
  `CREATE DATABASE` / `DROP DATABASE` **cannot run inside a transaction block**, so
  pass them as *separate* `-c` flags (one statement per `-c`), never joined with `;`
  in a single `-c`.

- **`alembic` / `python` / `pg_dump`** → run a one-off `backend` container. Its
  `WORKDIR` is `/app` (the backend root, where `alembic.ini` lives), so **no
  `cd backend` is needed** inside it. Override `DATABASE_URL` with `-e` so the same
  image points at whichever scratch DB the step needs:
  ```bash
  docker compose run --rm \
    -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${GENESIS_DB}" \
    backend sh -c 'echo "TARGET DB: $DATABASE_URL" && alembic <command>'
  ```
  The `echo "TARGET DB: $DATABASE_URL"` inside the `sh -c` satisfies Guardrail 1
  (show the target before every write); confirm it before approving a write step.

The generated migration files land in `backend/alembic/versions/` on the host via the
`./backend:/app` bind mount, so they are reviewable/committable from the host after the
container exits.

**Wrapper (optional):** [`sop/bin/db.sh`](../bin/db.sh) collapses these two patterns so you
don't retype the long URL (the main foot-gun — pointing a write at the real DB). It is
**project-agnostic**: it derives user/host/port from the app's `DATABASE_URL` (env, else
`./.env`) and only swaps the database name, so nothing app-specific is hard-coded. It always
echoes `TARGET DB`, and the **protected** database (writes refused outright) defaults to
whatever real DB `DATABASE_URL` names — here `rozetta_pms`, plus `postgres`/`template*`. It
**refuses** `upgrade`/`downgrade`/`stamp` and `throwaway drop` against those, prompts before
other writes (`DB_CONFIRM_YES=1` to skip), and deliberately does **not** automate the
cutover. Overridable via `DB_SERVICE` / `APP_SERVICE` / `DB_PORT` / `PROTECTED_DBS` env vars.
Run from anywhere in the repo:

```bash
sop/bin/db.sh throwaway create pms_genesis
sop/bin/db.sh alembic  pms_genesis revision --autogenerate -m "genesis schema"
sop/bin/db.sh alembic  pms_genesis upgrade head        # prompts; refused on rozetta_pms
sop/bin/db.sh psql     pms_genesis -c '\dt'
diff <(sop/bin/db.sh dump pms_createall) <(sop/bin/db.sh dump pms_genesis)
```

The raw `docker compose` forms below remain the source of truth for exactly what runs.

## Bootstrap: concrete command sequence

Copy-paste equivalents of the generic `db-bootstrap.md` steps, all run from the repo
root. Phase A is code edits only (no commands). Phases B–C below are non-destructive
(throwaway DBs only). Phase E is `[HUMAN CONFIRM]` and is described in the SOP.

```bash
# --- Prereq: .env must exist or `docker compose` aborts (backend has env_file: - .env) ---
[ -f .env ] || cp .env.example .env
source .env  # Load config (POSTGRES_USER, POSTGRES_PASSWORD, GENESIS_DB, CREATEALL_DB, etc.)

# --- Phase B.0: create the empty throwaway (two -c flags; DROP can't be in a txn) ---
docker compose exec db psql -U $POSTGRES_USER -d postgres \
  -c "DROP DATABASE IF EXISTS $GENESIS_DB;" \
  -c "CREATE DATABASE $GENESIS_DB;"

# --- Phase B.1/B.2: generate genesis against the throwaway (writes a file, not the DB) ---
docker compose run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${GENESIS_DB}" \
  backend sh -c 'echo "TARGET DB: $DATABASE_URL" && alembic revision --autogenerate -m "genesis schema"'
# Then review backend/alembic/versions/<hash>_genesis_schema.py (Bootstrap §B.3, [HUMAN CONFIRM]).

# --- Phase C.1: round-trip on the throwaway ---
docker compose run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${GENESIS_DB}" \
  backend sh -c 'echo "TARGET DB: $DATABASE_URL" && alembic upgrade head && alembic downgrade base && alembic upgrade head'

# --- Phase C.2: empty-diff (autogenerate a temp check; upgrade()/downgrade() must be just `pass`) ---
docker compose run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${GENESIS_DB}" \
  backend sh -c 'echo "TARGET DB: $DATABASE_URL" && alembic revision --autogenerate -m _tmp_check'
# Inspect the new file, confirm it is empty, then delete it before committing.

# --- Phase C.3: schema parity vs the create_all schema ---
# First boot the app once against a fresh $CREATEALL_DB DB with create_all() still enabled,
# then dump and diff (pg_dump/diff both run inside the backend container):
docker compose exec db psql -U $POSTGRES_USER -d postgres \
  -c "DROP DATABASE IF EXISTS $CREATEALL_DB;" -c "CREATE DATABASE $CREATEALL_DB;"
docker compose run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${CREATEALL_DB}" \
  backend sh -c 'python -c "from app.core.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine)"'
docker compose run --rm backend sh -c '\
  pg_dump --schema-only --no-owner --no-privileges "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${CREATEALL_DB}" > /tmp/createall.sql && \
  pg_dump --schema-only --no-owner --no-privileges "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${GENESIS_DB}"   > /tmp/migrated.sql && \
  diff /tmp/createall.sql /tmp/migrated.sql'
# PASS = empty diff, or every hunk listed under "Known-benign parity diffs" below.
```

## Expected tables (registry completeness check, Bootstrap §A.4)

`Base.metadata.tables` must list every model table before generating genesis. Confirm the
full set (pitches, assessments, users, meetings, organisations, contacts, plus any join /
activity / file-link tables). `app/models/__init__.py` must import every model module or
the table won't register.

> **TODO to verify before bootstrap:** confirm `app/models/__init__.py` imports all model
> modules. The real `env.py` uses `from app.models import Base` (narrow), so completeness
> depends entirely on `__init__.py`.

## Enum types (`{{ENUM_TYPES}}`)

There are **7** Postgres enum types (one per `str, enum.Enum` class in the models). The
Postgres type name is the lowercased class name; SQLAlchemy persists the member **names**
(uppercase), so the genesis migration lists e.g. `ADMIN`, `RECEIVED` — not the values.

| Type (`name=`) | Class / defined in | Persisted as | Members |
|------|-----------|--------------|--------|
| `pipelinestage` | `PipelineStage` — `models/pitch.py` | `pitches.current_stage`, `pitch_stage_history.from_stage`/`to_stage` | 10: RECEIVED, INITIAL_SCREEN, DISCOVERY_MEETING, DEEP_ASSESSMENT, DUE_DILIGENCE, DECISION_PENDING, ACTIVE_SUPPORT, PARKED, DECLINED, COMPLETED |
| `pitchsource` | `PitchSource` — `models/pitch.py` | `pitches.source` | REFERRAL, WEBSITE, EVENT, COLD_OUTREACH, INTERNAL |
| `fundingpathway` | `FundingPathway` — `models/pitch.py` | `pitches.funding_pathway` | CRC_BID, RDTI, PHILANTHROPIC, GOVERNMENT_GRANT, PRIVATE, OTHER |
| `userrole` | `UserRole` — `models/user.py` | `users.role` | ADMIN, ASSESSOR, VIEWER |
| `orgtype` | `OrgType` — `models/organisation.py` | `organisations.org_type` | STARTUP, UNIVERSITY, NGO, GOVERNMENT, CONSORTIUM, RESEARCH_CENTRE, OTHER |
| `meetingplatform` | `MeetingPlatform` — `models/meeting.py` | `meetings.platform` | ZOOM, TEAMS, IN_PERSON, PHONE, OTHER |
| `recommendation` | `Recommendation` — `models/assessment.py` | `assessments.recommendation` | PROCEED, PARK, DECLINE |

The **6 assessment criteria** are **not** an enum and not reference rows — they are six
integer columns on the `assessments` table (`national_impact`, `translation_readiness`,
`team_capability`, `ecosystem_fit`, `funding_pathway_clarity`, `masterplan_alignment`).
Nothing to seed.

Genesis migration must create **all 7** enum types **before** the tables using them, and
`downgrade()` must drop all 7 (the `alembic_postgresql_enum` hook handles this once
installed). Verified in `00c08650ab04_genesis_schema.py`: all 7 are created at the top of
`upgrade()` and dropped at the end of `downgrade()`; columns reference them with
`create_type=False`.

## Current migration state

- **Phase A is done** (branch `chore/alembic-bootstrap-phase-a`): `env.py` imports the
  `alembic_postgresql_enum` hook and builds the engine via `create_engine(...)` (so a `%`
  in the password can't break ConfigParser interpolation), keeping `compare_type` /
  `compare_server_default`; `alembic-postgresql-enum==1.7.0` is in `backend/requirements.txt`;
  and `backend/alembic/versions/` now exists (empty but for `.gitkeep`). A.4 registry check
  passed — all 10 expected tables register.
- `create_all()` at `main.py:12` is still the **only** thing creating the schema
  (tables + `CREATE TYPE`). Do not remove it until genesis exists (Phase B), Phase C is all
  PASS, and the migrate job is enabled (Phase E).
- **Abandoned-migration check (done):** the `"wip: fix migrations?"` marker refers to
  **commit `106af4a`** (not `main.py:106` — `main.py` is only ~59 lines). That commit and
  its follow-up `fb74e14` added the migration *test harness* (`backend/tests/migrations/`,
  `pytest.ini`) and the `env.py` URL/compare changes — **not** any migration file.
  `git log --all -- backend/alembic/versions/` is empty on every branch, so there is no
  half-written migration to salvage or collide with. The genesis migration is the entire
  schema.
- The pre-existing `backend/tests/migrations/` harness (`pytest tests/migrations -m migrations`)
  is kept and used to automate the Phase C round-trip / empty-diff checks — it complements,
  and does not replace, this SOP.

## Cutover branch: `fresh`

The current dev DB holds **test data only, no real/prod data**, so the `stamp` branch is
**not** needed for this app. Use Bootstrap Phase E branch `fresh`: provision/convert to the
managed DB, `alembic upgrade head` from empty, reload synthetic test/demo data, remove
`create_all()`, enable the migrate job. No `stamp`.

The Phase C schema-parity check still applies — it validates that genesis reproduces the
`create_all` schema. For `{{CREATE_ALL_DB_URL}}`, boot the app once against a throwaway with
`create_all` still enabled and dump that.

## Backups / DB tier

Managed DB is currently `production: false` (dev tier — no backups, no PITR). Bootstrap
Phase F: flip to `production: true` before any real pilot data lands. Until then, restore
is not available.

## Known-benign parity diffs

_(none recorded yet — populate this list during Bootstrap Phase C if any pg_dump hunks are
judged benign, e.g. enum value ordering, so future runs know they're expected.)_
