# Best practices — database migrations, deployment & rollback

How to evolve the Postgres schema safely: forward migrations, deployment, and
rollback. Anchored to Alembic (`backend/alembic/`) and the DigitalOcean App
Platform spec (`.do/app.yaml`).

## Current state (read this first)

The migration path is **not yet wired up**. Before the plan below is meaningful,
three gaps must close:

1. **No migrations exist.** `backend/alembic/versions/` is empty. The schema is
   currently created by `Base.metadata.create_all(bind=engine)` at startup
   (`app/main.py`). That handles a first deploy but applies **no later schema
   change** and gives **no rollback path**.
2. **`alembic/env.py` ignores the environment.** It reads `sqlalchemy.url` from
   `alembic.ini` — a hardcoded placeholder pointing at the local `db` host. It does
   *not* read `settings.DATABASE_URL`, so the DO migrate job (which injects
   `DATABASE_URL`) would run against the wrong database. Fix `env.py` to prefer
   `os.environ["DATABASE_URL"]` / `settings.DATABASE_URL` before doing anything else.
3. **The deploy migrate job is commented out** in `.do/app.yaml`, and the managed DB
   is `production: false` (no automated backups → no restore-based rollback on that
   tier).

Until (1) and (2) are done, any migration/rollback test is a false pass.

## Ground rules

- **Alembic owns the schema.** Once the baseline migration lands, remove
  `create_all()` from `app/main.py` startup and apply schema via
  `alembic upgrade head` (a PRE_DEPLOY job in prod). Startup-time `create_all` and
  migrations must not both manage the schema — they will fight.
- **Every migration has a real `downgrade()`.** `--autogenerate` often emits an
  incomplete or empty downgrade. A rollback is only as good as the `downgrade()` you
  hand-verify. If a downgrade is genuinely lossy (e.g. dropping a populated column),
  say so in the migration docstring rather than pretending it reverses.
- **Test migrations against real Postgres, never SQLite.** The test suite runs on
  in-memory SQLite (`backend/tests/conftest.py`), which accepts DDL Postgres rejects
  and can't model Postgres `ALTER`/rollback semantics. Migration tests need a real
  Postgres instance (throwaway container).
- **Prefer expand/contract.** Additive migration → deploy code tolerant of both old
  and new shapes → later contract (drop the old). Each step is independently
  reversible, and a forward deploy never needs a lockstep rollback.
- **One head.** Keep the revision history linear; `alembic heads` should return
  exactly one. Resolve branches with an explicit merge revision.

## The testing plan

Run against a throwaway Postgres (`docker run --rm -e POSTGRES_PASSWORD=... -p ...
postgres:16`, matching the prod major version). Four levels, cheapest first.

### Level 1 — Schema round-trip (reversibility)

Proves each migration is structurally reversible and leaves a clean slate.

```
alembic upgrade head     # forward
alembic downgrade base   # full rollback
alembic upgrade head     # forward again
```

Then assert **autogenerate produces an empty diff** at head (schema matches the
models in `app/models/`) and `alembic heads` returns a single head.

### Level 2 — Data-safety round-trip (the one that matters)

Catches migrations that corrupt or drop real data.

1. Apply migrations up to the *previous* revision.
2. Seed representative rows (a pitch with stage history, contacts, an assessment —
   enough to exercise FKs and NOT-NULL columns).
3. `alembic upgrade head`; assert existing data is preserved / correctly transformed.
4. `alembic downgrade -1`; assert it reverses **without unintended data loss**. Any
   intentionally lossy downgrade must be asserted-and-documented, not discovered later.

### Level 3 — Deployment rehearsal (staging clone)

Tests the upgrade-from-real-state path a from-empty test misses. Clone the current
prod schema+data into staging, run the exact deploy step (`alembic upgrade head`),
then smoke-test the app against the migrated DB (`/api/health`, a couple of read
routes, one write).

### Level 4 — Rollback rehearsal

Rehearse the rollback story you'll actually use — they differ:

- **Schema downgrade** — `alembic downgrade -1` + redeploy the previous image. Fast;
  only safe when downgrades are truly reversible (Level 2 green).
- **Restore from backup** — restore a pre-migration snapshot + redeploy the previous
  image. The safe path for irreversible/lossy migrations, but **requires a backed-up
  DB tier** (`production: true` in `.do/app.yaml`); the current dev-grade tier has no
  automated backups.

Decide per migration which applies, and note it in the migration docstring.

## CI wiring

Add a job that spins up ephemeral Postgres and runs **Levels 1–2** on every PR that
touches `backend/alembic/` or `backend/app/models/`. This is the gate that stops a
bad `downgrade()` (or a model change with no migration) reaching `main`. Keep it
separate from the SQLite unit-test job — different database, different purpose.

## Deploying migrations on DigitalOcean

Once (1)–(2) above are done, enable the PRE_DEPLOY `migrate` job already stubbed at
the bottom of `.do/app.yaml` (`run_command: alembic upgrade head`) and remove
`create_all()` from `app/main.py` startup. PRE_DEPLOY runs the migration before the
new app instances take traffic; combined with expand/contract, that keeps deploys
zero-downtime and each step reversible.

## See also

- [`database-integration.md`](database-integration.md) — how schema changes ripple
  through the `*Out` schemas and the frontend.
- `AGENTS.md` — "enforce data integrity in app code, not DB cascades" (SQLite tests
  don't enforce FKs); migrations should still declare constraints for Postgres.
