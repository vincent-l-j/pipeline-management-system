# Instance sheet: Rozetta PMS

Per-app values the DB SOPs plug into. The SOPs
([`db-bootstrap.md`](../db-bootstrap.md),
[`db-change.md`](../db-change.md)) are generic; this file is the app-specific part.
Keep it current — the SOPs trust it.

## Current migration state

The **code artifacts** for managed Alembic are done and committed:

- `create_all()` has been removed from `backend/app/main.py`; nothing builds the schema on
  startup.
- The genesis migration `backend/alembic/versions/a1a27441d35c_genesis_schema.py` is committed
  and is the single Alembic head.
- The `PRE_DEPLOY` `migrate` job (`alembic upgrade head`) is wired in both `.do/app.yaml`
  (production) and `.do/staging.yaml` (staging).
- The migration suite runs in CI (`.github/workflows/ci.yml`, the `migrations` job).

**Cutover status differs per environment:**

- **Staging** — cutover **complete**. It was deployed on the `fresh` branch (empty dev-tier
  DB), the migrate job ran `alembic upgrade head`, and the app runs on managed Alembic.
- **Production** — **stamped; awaiting first deploy.** Cutover ran on the **`stamp`** branch
  (`CUTOVER_BRANCH=stamp` in `.env`) because the prod DB already holds real data built by the
  old `create_all()` schema. Completed: full backup of the cluster (`defaultdb` + `db`) with
  `verify-full` SSL and an on-cluster restore check; schema-parity diff vs genesis (one real
  drift found and reconciled — see "Production stamp cutover" below); and `alembic stamp head`,
  which set `alembic_version` to `a1a27441d35c`. **Still pending:** the first production deploy
  (push `main` → `deploy-production.yml`), where the `PRE_DEPLOY` `alembic upgrade head` is now
  a **no-op** (already at head). Merge the genesis migration + `.do/app.yaml` to `main` first —
  the deploy spec pins `branch: main`.

Managed-DB tier: production is the backed-up HA tier (`production: true` in `.do/app.yaml`);
staging is dev-tier (`production: false` in `.do/staging.yaml`).

Once production is stamped and deployed, the ongoing path becomes
[`db-change.md`](../db-change.md). The **Bootstrap** section below is the generic procedure
and the reference record of how the cutover was done.

## Stack

Standard stack: FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL 16 + DigitalOcean App
Platform. No deviations.

## Configuration

**Configuration comes from `.env` in the repo root** — copy `.env.example` and customize
for your environment. See that file for all variables. Database credentials and URLs are
derived from `$POSTGRES_USER`, `$POSTGRES_PASSWORD`, and database names you choose.

## DigitalOcean Bindable Variables & Non-Default Credentials ⚠️

**Gotcha:** The `DATABASE_URL` bindable variable (`${db-pgsql-*.DATABASE_URL}`) in DO App Platform
only resolves to the **default db_user and db_name**. If your app uses non-default credentials
(a different `db_user` or `db_name`), the bindable variable will **not work** — the app will fail
to connect.

**Why this matters:** You may want different credentials per environment (e.g., separate databases
in the same cluster), but the bindable variable bypasses your custom values.

**Solution:** Instead of using the bindable variable, manually copy the connection string from the
DigitalOcean Database UI:

1. Go to DigitalOcean Dashboard → Databases → your cluster
2. Click **Connection Details**
3. Copy the **"Connection string"** for your specific db_user and db_name
4. Paste it as the `DATABASE_URL` env var in your app spec (replace the bindable variable)

The manual connection string will include your exact username and database name, so the app
connects as intended.

## Environment: where and how to run SOP commands

**This host has no local `python`, `alembic`, `psql`, or `pg_dump`.** The whole
toolchain lives in the Docker images. So every DB/Alembic step in the SOPs runs
*inside a container*, launched with `docker compose` **from the repo root** (the
directory that contains `docker-compose.yml` — e.g. `.../pipeline-management-system/`).
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

- **`psql` / `pg_dump` / database admin** → run in the `db` container (`postgres:16`,
  which is where the Postgres client tools live — the `backend` image does **not** ship
  `psql`/`pg_dump`). Use `exec` against the already-running container, or `run` when you
  need to bind-mount a file (e.g. a CA cert):
  ```bash
  docker compose exec db psql -U rozetta -d <database> -c "<SQL>"
  docker compose exec -T -e U="<url>" db sh -c 'pg_dump --no-owner --no-privileges "$U"' > dump.sql
  ```
  `CREATE DATABASE` / `DROP DATABASE` **cannot run inside a transaction block**, so
  pass them as *separate* `-c` flags (one statement per `-c`), never joined with `;`
  in a single `-c`.

- **`alembic` / `python`** → run a one-off `backend` container. Its
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
**refuses** `upgrade`/`downgrade`/`stamp` and any `throwaway` op against those, prompts before
other writes (`DB_CONFIRM_YES=1` to skip), and deliberately does **not** automate the
cutover. Overridable via `DB_SERVICE` / `APP_SERVICE` / `DB_PORT` / `PROTECTED_DBS` env vars.
Run from anywhere in the repo:

```bash
sop/bin/db.sh throwaway create pms_genesis
sop/bin/db.sh alembic  pms_genesis revision --autogenerate -m "genesis schema"
sop/bin/db.sh alembic  pms_genesis upgrade head        # prompts; refused on rozetta_pms
sop/bin/db.sh psql     pms_genesis -c '\dt'
# `dump` runs pg_dump via APP_SERVICE, which defaults to `backend` — but the backend
# image has no pg_dump. Override APP_SERVICE=db (the postgres:16 image) for dumps:
diff <(APP_SERVICE=db sop/bin/db.sh dump pms_createall) <(APP_SERVICE=db sop/bin/db.sh dump pms_genesis)
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
# First boot the app once against a fresh $CREATEALL_DB DB with create_all() still enabled
# (python, in the backend image), then dump and diff (pg_dump runs in the db container —
# the backend image has no pg_dump):
docker compose exec db psql -U $POSTGRES_USER -d postgres \
  -c "DROP DATABASE IF EXISTS $CREATEALL_DB;" -c "CREATE DATABASE $CREATEALL_DB;"
docker compose run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${CREATEALL_DB}" \
  backend sh -c 'python -c "from app.core.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine)"'
# Expand vars on the HOST (redirect on the host too, outside any quotes), and connect over
# the local socket with -U (trust auth — no password, so it can't drift from a stale pgdata
# volume). FIRST verify the host actually sourced .env — a stale/empty $POSTGRES_USER surfaces
# as `role "db" does not exist` (or `password authentication failed for user "db"` when the
# vars are instead expanded inside a single-quoted `sh -c` on a one-off `run` container, where
# compose has not set them):
#   source .env && echo "user=[$POSTGRES_USER] createall=[$CREATEALL_DB] genesis=[$GENESIS_DB]"
docker compose exec -T db \
  pg_dump --schema-only --no-owner --no-privileges -U "$POSTGRES_USER" "$CREATEALL_DB" > /tmp/createall.sql
docker compose exec -T db \
  pg_dump --schema-only --no-owner --no-privileges -U "$POSTGRES_USER" "$GENESIS_DB" > /tmp/migrated.sql
diff /tmp/createall.sql /tmp/migrated.sql
# PASS = empty diff, or every hunk listed under "Known-benign parity diffs" below.
```

## Known-benign parity diffs

The Phase C.3 (`createall` vs genesis) and prod-vs-genesis diffs PASS when empty, or when
every remaining hunk is one of these — observed, expected, and **not** schema differences:

- **`\restrict` / `\unrestrict` lines** — random per-dump session tokens emitted by
  `pg_dump` 16.x. They differ on every dump by design; ignore them.
- **`alembic_version` table + `alembic_version_pkc` primary key** — Alembic's own version
  bookkeeping. It exists only on the *migrated* side (genesis-built, or a stamped prod), never
  in a `create_all` dump. Its presence is exactly what you want — it is the table the stamp
  writes to.
- **Cross-server preamble** when one side is the DO managed cluster — extra `SET` /
  `SELECT pg_catalog.set_config(...)` lines and differing comments.

`[STOP IF]` any hunk touches structural DDL — a table, column, index, constraint, or enum
type/value. That must match exactly before stamping.

## Production TLS connections

Production runs on a **DigitalOcean managed Postgres cluster** reached over TLS. Connections
(for backup/restore) must use `sslmode=verify-full` with DO's CA certificate. Download the CA
from the DO control panel (Databases → cluster → Connection Details → *Download CA certificate*).
It lives on the host, so it must be **mounted into the container**:

```bash
export PROD_DATABASE_URL='postgresql://doadmin:<pw>@<cluster-host>.db.ondigitalocean.com:25060'  # no db name / query
export HOST_CERT='/absolute/path/to/ca-certificate.crt'   # absolute; quote it — spaces break `-v`
# Helper scripts append /defaultdb?sslmode=verify-full&sslrootcert=/tmp/ca-certificate.crt
```

`verify-full` also checks the hostname against the cert, so connect via DO's hostname (not an
IP). If you hit a hostname mismatch, fall back to `sslmode=verify-ca`.

> **The `prod-db-backup.sql` dump contains production data** and is gitignored (`*.sql`).
> Never commit it; delete it from the working tree once verified.

**Reconciliation record — `pitch_stage_history.changed_at` (drift found at parity check).**
The prod-vs-genesis schema diff surfaced one real structural hunk: prod had
`changed_at timestamp without time zone`, genesis has `timestamp with time zone`. Cause:
commit `712e5d1 feat(backend): timezone pitch.changed_at` changed the model from
`datetime.utcnow` (naive) to `DateTime(timezone=True)` / `datetime.now(timezone.utc)`, but
`create_all` never `ALTER`s an existing column, so prod kept the old naive type while staging
(built fresh) got `timestamptz`. Because the stored values were naive **UTC**, they convert
losslessly. Reconciled on prod *before* stamping (backup already taken):
```sql
ALTER TABLE pitch_stage_history
  ALTER COLUMN changed_at TYPE timestamptz USING changed_at AT TIME ZONE 'UTC';
```
Re-diff was then clean (only benign hunks), and prod was `alembic stamp head`-ed to
`a1a27441d35c`. General guidance for *drastic* drift lives in `db-bootstrap.md` — do **not**
stamp a schema that isn't head; baseline the migration history on prod's real schema and
migrate forward instead.

**Still pending for production:**

1. First production deploy — push to `main` (triggers `.github/workflows/deploy-production.yml`);
   the `PRE_DEPLOY` migrate job's `alembic upgrade head` is then a no-op (already at head).
   Merge the genesis migration + `.do/app.yaml` to `main` first (the spec pins `branch: main`).
2. Post-deploy: `curl -sf https://ims.rozettainstitute.com/api/health` and delete the local
   `prod-*.sql` dumps.

## Disaster Recovery: Cluster Restoration

Procedure for restoring a production database from backup, e.g., if the current cluster is
corrupted or lost. This creates an entirely new PostgreSQL cluster in DigitalOcean, restores
data from a backup, and reconnects the app.

**Prerequisites:**

- An existing backup dump file (`prod-db-backup.sql`, created with `sop/bin/backup-db.sh`)
- Access to DigitalOcean API/dashboard and GitHub repo
- The app's `.do/app.yaml` app spec accessible for editing

**Workflow (test with GitHub Actions):**

1. **Create new empty PostgreSQL cluster in DigitalOcean.**
   - Dashboard → Databases → Create Cluster
   - Use same version as original (currently PostgreSQL 16), same region, same tier
   - Wait for it to fully provision and display Connection Details
   - **Download the CA certificate** from Connection Details (you'll need it for restore)

2. **Backup from the old cluster (if not already done).**

   ```bash
   export PROD_DATABASE_URL='postgresql://doadmin:<pw>@<old-cluster-host>.db.ondigitalocean.com:25060'
   export HOST_CERT='/absolute/path/to/ca-certificate.crt'  # from old cluster
   sop/bin/backup-db.sh
   # Creates prod-db-backup.sql
   ```

3. **Restore into the new cluster.**
   - Update env vars to point at the new cluster:
     ```bash
     export PROD_DATABASE_URL='postgresql://doadmin:<pw>@<new-cluster-host>.db.ondigitalocean.com:25060'
     export HOST_CERT='/absolute/path/to/new-ca-certificate.crt'  # from NEW cluster
     ```
   - Run the restore:
     ```bash
     sop/bin/restore-db.sh
     # Restores prod-db-backup.sql into defaultdb, verifies via re-dump and diff
     ```
   - The script re-dumps `defaultdb` and diffs it against the original backup. If the diff is
     clean (empty output), the restore is faithful. If not, [STOP] — investigate the drift.

4. **Prepare app spec (`.do/app.yaml`) for two-phase deployment.**

   **Phase 1: Remove migration job and old database.**
   - Edit `.do/app.yaml` and:
     - Delete the entire `jobs:` block (or just the `migrate` job if there are others)
     - Delete the old `databases:` entry (the cluster that failed/is being replaced)
   - Commit and push to `main` (or your deploy branch)
   - GitHub Actions triggers `deploy-production.yml` → waits for approval → deploys
   - **Verify:** App is unreachable or errors (it has no database attached — this is expected)

5. **Phase 2: Attach new database and restore migration job.**
   - Edit `.do/app.yaml` and add:
     - New `databases:` block pointing to the new cluster (copy the connection details from DO)
     - Re-add the `jobs:` block with the `migrate` job
     - **Critical:** Ensure the job's `DATABASE_URL` bindable var (`${db.DATABASE_URL}`) matches the
       `databases` component name (`db`). Mismatch causes the migration to fail.
   - Commit and push
   - GitHub Actions triggers `deploy-production.yml` → waits for approval → deploys
   - **Verify:** `curl -sf https://ims.rozettainstitute.com/api/health` returns 200
   - App should now serve the restored data

6. **Cleanup.**
   - Delete the old PostgreSQL cluster from DigitalOcean Dashboard (it is no longer needed)
   - Delete local backup and CA certificate files (they contain sensitive data):
     ```bash
     rm prod-db-backup.sql ca-certificate.crt new-ca-certificate.crt
     ```

**Gotchas:**

- DigitalOcean App Platform won't delete and add a database in the same deployment. It must be
  two separate deployments (remove old, then add new), else the migration job tries to run
  against a non-existent database and the deploy reverts.
- Every cluster has its own CA certificate. When you create a new cluster, download its new CA
  cert; the old one won't work for the new cluster.
- The `databases` component name must match the job's `DATABASE_URL` bindable var. If they
  disagree (e.g. `databases: [db]` but `DATABASE_URL: ${mydb.DATABASE_URL}`), the migration
  job fails.

## Expected tables (registry completeness check, Bootstrap §A.4)

`Base.metadata.tables` must list every model table before generating genesis. Confirm the
full set (pitches, assessments, users, meetings, organisations, contacts, plus any join /
activity / file-link tables). `app/models/__init__.py` must import every model module or
the table won't register.

> **Verified (kept as a standing check):** `app/models/__init__.py` imports every model
> module — `base`, `user`, `organisation`, `contact`, `pitch`, `meeting`, `assessment` — so the
> narrow `from app.models import Base` in `env.py` sees the complete registry. Re-confirm this
> if a new model module is ever added, or its tables will be silently missing from autogenerate.

## Enum types

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
installed). Verified in `a1a27441d35c_genesis_schema.py`: all 7 are created at the top of
`upgrade()` and dropped at the end of `downgrade()`; columns reference them with
`create_type=False`.
