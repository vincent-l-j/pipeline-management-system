# SOP: Bootstrap Alembic migrations for a new app

**Applies to:** any app on the standard stack — FastAPI + SQLAlchemy 2.0 + Alembic +
PostgreSQL + DigitalOcean App Platform.

**Use this once per app**, to move an app from `Base.metadata.create_all()` onto managed
Alembic migrations. For ongoing field/table changes after this, use
[`db-change.md`](./db-change.md).

**When to run this.** `create_all()` at startup is acceptable *only* during an app's
earliest phase — while **all** of these hold: no shared/deployed environment, no data
you'd be upset to lose, a single developer, and a schema still changing daily. Run this
SOP the moment **any** of them stops being true (a shared staging/preview URL, a second
developer, imminent real data, or a schema that has settled). Bootstrapping is cheapest
against an empty/disposable DB — the `fresh` cutover below; leaving `create_all()` in
place until real data exists forces the riskier `stamp` cutover and leaves the app with no
safe schema-change or rollback path in the meantime.

**Configuration comes from `.env` in the repo root.** Before running these steps, ensure
`.env` is set up — copy from `.env.example` and customize as needed for your environment.

---

## 0. Guardrails — read before running anything

This SOP contains destructive and irreversible steps. If you are an agent executing it:

1. **Echo and confirm the target before every write.** Before any `alembic upgrade`,
   `alembic downgrade`, `alembic stamp`, or `pg_dump` restore, run
   `echo "TARGET DB: $DATABASE_URL"` and get explicit human confirmation that this is the
   intended database. Never run a write step against a `DATABASE_URL` you have not shown
   the human in this session.
2. **Never run migrate/downgrade/stamp against production** in this SOP. Production is
   only touched in Phase E, and only on the branch the instance sheet selects.
3. **Steps marked `[HUMAN CONFIRM]` require a human to approve before you proceed.** Do
   not self-approve.
4. **`[STOP IF ...]` is a hard halt.** If the condition is true, stop and report; do not
   continue or "work around" it.
5. Pass/fail for each check is defined concretely below. If a result is ambiguous, treat
   it as fail and HALT.
6. **Where to run.** The commands below assume a shell that has the app's Python env,
   Alembic, and `psql`/`pg_dump` on `PATH`. If that toolchain lives only in containers
   (as it does for Rozetta PMS — no host `python`/`alembic`/`psql`), run each step *inside*
   the appropriate container from the repo root, and use the copy-paste command sequence in
   the instance sheet rather than these bare commands. Note `CREATE DATABASE` / `DROP
   DATABASE` cannot run inside a transaction block — issue them as separate statements.

---

## 1. Preconditions

Ensure `.env` includes:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL` (the target managed DB)
- `CUTOVER_BRANCH` (either `fresh` for a test/empty DB, or `stamp` to preserve existing data)

`[STOP IF]` `CUTOVER_BRANCH` is unset or unclear — the branch changes the risk profile and
must be decided by a human first.

---

## 2. Phase A — Prepare `env.py` and dependencies (local, non-destructive)

Nothing here touches a database.

1. Add the enum autogenerate hook to `backend/alembic/env.py` (top of file):
   ```python
   import alembic_postgresql_enum
   ```
   This is required even for the genesis migration, so downgrade drops enum types cleanly
   (see Phase C round-trip). Without it, autogenerate does not detect enum value changes
   and does not drop enum types on downgrade.

2. Add `alembic-postgresql-enum` to **`backend/requirements.txt`** — the runtime file, not
   `requirements-dev.txt`. The pre-deploy migrate job imports `env.py` from the production
   image, so the hook must ship in production. `[STOP IF]` it is only in dev deps: prod
   migrations will `ImportError`.

3. Ensure `env.py` builds the engine directly from settings, so a `%` in the DB password
   can't break ConfigParser interpolation:
   ```python
   from sqlalchemy import create_engine
   # online:
   connectable = create_engine(settings.DATABASE_URL, poolclass=pool.NullPool)
   # offline:
   url = settings.DATABASE_URL or config.get_main_option("sqlalchemy.url")
   ```

4. **Confirm the model registry is complete.** Run:
   ```bash
   cd backend && python -c "from app.models import Base; print(sorted(Base.metadata.tables))"
   ```
   `[STOP IF]` any expected table (per instance sheet) is missing — `app/models/__init__.py`
   isn't importing that module. Fix the import before generating anything; a missing table
   here silently produces an incomplete genesis migration.

5. Ensure `backend/alembic/versions/` exists and `script.py.mako` is present:
   ```bash
   ls backend/alembic/versions/ backend/alembic/script.py.mako
   ```
   Create the `versions/` directory if absent.

Commit Phase A on its own branch. It changes no runtime behaviour.

---

## 3. Phase B — Generate the genesis migration (empty throwaway DB)

1. Create a **fresh, empty** throwaway Postgres database (not the app's real dev DB).
   Derive the URL from `$POSTGRES_USER`, `$POSTGRES_PASSWORD`, and a new database name:
   ```bash
   export THROWAWAY_DB_NAME=genesis  # or your chosen name
   export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${THROWAWAY_DB_NAME}"
   echo "TARGET DB: $DATABASE_URL"        # confirm it is the throwaway
   ```
2. Generate:
   ```bash
   docker compose run --rm -T backend sh -c 'alembic revision --autogenerate -m "genesis schema"'
   ```
   Subsequent runs will result in the following error and is the expected behaviour:
   ```
   ERROR [alembic.util.messaging] Target database is not up to date.
   FAILED: Target database is not up to date.
   ```
3. **Read the entire generated file.** Confirm:
   - every table from step A.4 is created;
   - each enum type is created **before** the table/column that uses it;
   - foreign keys, indexes, and unique constraints are present;
   - `downgrade()` drops tables and enum types (the hook should handle enum drops).

   `[HUMAN CONFIRM]` the file is complete and correct before continuing. Autogenerate is
   not authoritative — this review is.

---

## 4. Phase C — Validate on the throwaway

All three checks run against the empty throwaway from Phase B. Confirm `$DATABASE_URL`
points there first.

1. **Round-trip.** The second upgrade is where dangling enum types surface.
   ```bash
   docker compose run --rm -T backend sh -c 'alembic upgrade head; alembic downgrade base; alembic upgrade head'
   ```
   PASS = all three succeed with exit 0. `[STOP IF]` the second `upgrade head` errors with
   "type already exists" — downgrade isn't dropping an enum type; fix `downgrade()`.

2. **Empty-diff.** Prove the migration matches the models exactly.
   ```bash
   docker compose run --rm -T backend sh -c 'alembic revision --autogenerate -m _tmp_check'
   ```
   PASS = the new file's `upgrade()` and `downgrade()` bodies contain only `pass` (no
   operations). Then delete `_tmp_check`. `[STOP IF]` it contains any operation — the
   genesis migration does not match the models; reconcile and regenerate.

3. **Schema parity with the current `create_all` schema.** Prove genesis reproduces what
   the app builds today. Create a second throwaway DB and boot the app against it with
   `create_all()` still enabled, then diff the schemas:
   ```bash
   export CREATEALL_DB_NAME=createall  # or your chosen name
   # Create throwaway, boot app with create_all() to populate it, then dump
   pg_dump --schema-only --no-owner --no-privileges "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${CREATEALL_DB_NAME}" > /tmp/createall.sql
   # Compare against the migrated schema
   pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > /tmp/migrated.sql
   diff /tmp/createall.sql /tmp/migrated.sql
   ```
   PASS = empty diff, or every remaining hunk is listed as benign in the app's instance sheet
   (e.g., known enum-value ordering). `[STOP IF]` any unexplained hunk remains — do not
   proceed to cutover on an unverified schema.

---

## 5. Phase D — Commit the checkpoint (still safe)

Commit `versions/` plus the Phase A `env.py`/deps changes with **`create_all()` still in
place and the migrate job still commented out**. This changes nothing about running
environments and is a clean review point. Cutover is deliberately a separate change.

---

## 6. Phase E — Cutover  `[HUMAN CONFIRM required for the whole phase]`

Follow the branch specified in `$CUTOVER_BRANCH` from `.env`.

### Branch `fresh` — source DB holds no data worth keeping

1. Provision (or convert to) the managed Postgres for the environment.
2. `echo "TARGET DB: $DATABASE_URL"` → confirm it is the intended target `[HUMAN CONFIRM]`.
3. `alembic upgrade head` against the empty managed DB.
4. Remove `create_all()` from the app's startup code (find it by searching the app or
   asking the team; e.g., `backend/app/main.py`).
5. Uncomment the `PRE_DEPLOY` migrate job in `.do/app.yaml` that runs `alembic upgrade head`.
6. No `stamp` is used on this branch.

### Branch `stamp` — source DB holds data to preserve

1. **Back up first, unconditionally.** `pg_dump` the source DB to a safe location and
   confirm the dump restores into a throwaway before touching the original. `[STOP IF]`
   the backup can't be verified.
2. Confirm Phase C parity passed **against the live source DB** (not just a local
   `create_all` schema — the two can differ if a model change never reached the source, since
   `create_all` never `ALTER`s existing columns). `[STOP IF]` it did not — stamping a DB whose
   schema doesn't match the genesis migration corrupts migration history. On mismatch:
   - **Minor drift** (a column type, a missing index): reconcile the source DB up to the
     genesis baseline with a hand-run `ALTER` (verify the data conversion is lossless), re-diff
     until only benign hunks remain, then stamp.
   - **Drastic drift** (many tables/columns diverge): do **not** hand-align or stamp head.
     Baseline the migration history on the source's *real* schema (autogenerate an initial
     revision against a restored copy, `stamp` that), then author reviewed, CI-tested,
     reversible forward migrations for each delta and `upgrade` through them. Stamp only a
     revision the DB actually matches.
3. `echo "TARGET DB: $DATABASE_URL"` → confirm target `[HUMAN CONFIRM]`.
4. `alembic stamp head` — marks the existing schema as already at head. Do **not** run
   `upgrade` on this branch.
5. Remove `create_all()` and uncomment the migrate job as in steps E.5–E.6 above.

---

## 7. Phase F — Enable backups before real data

`[STOP IF]` production will hold real data and the managed DB is still `production: false`.
Flip `production: true` on the `databases:` block in `.do/app.yaml` for HA, automated
backups, and point-in-time recovery **before** real users depend on it. Automated
backups/PITR do not exist on the dev tier (see
[`migrations.md`](../docs/best-practices/migrations.md), "Level 4 — Rollback rehearsal").

---

## 8. Done criteria

- `versions/` contains a reviewed genesis migration; Phase C all PASS.
- `create_all()` removed; `PRE_DEPLOY` migrate job enabled.
- Managed DB promoted to `production: true` before any real data.
- The app deploys, the migrate job runs `upgrade head` cleanly, and the app boots.
- Ongoing changes now follow [`db-change.md`](./db-change.md).
