# Best practices — database migrations, deployment & rollback

How to evolve the Postgres schema safely: forward migrations, deployment, and
rollback. Anchored to Alembic (`backend/alembic/`) and the DigitalOcean App
Platform spec (`.do/app.yaml`).

## Setup lifecycle: `create_all` → Alembic

Every app on this stack moves through two stages once. This section describes the
_pattern_; **it does not record where any given app currently sits** — that would rot.
For an app's live position, see **"Current migration state"** in its instance sheet
(`sop/instances/<app>.md`); the [`db-bootstrap.md`](../../sop/db-bootstrap.md) SOP is the
generic cutover procedure, not a per-app status record.

1. **Scaffolding (`create_all`).** `Base.metadata.create_all(bind=engine)` at startup
   (`app/main.py`) builds the whole schema from the models on boot. Fine for the earliest
   phase of a new app — the schema churns constantly, there's no data worth keeping, and
   migrations would be pure friction. But it applies **no incremental change** to an
   existing database and gives **no rollback path**, so it cannot be how a real,
   deployed-with-data app evolves.
2. **Managed migrations (Alembic owns the schema).** A genesis migration reproduces the
   `create_all` schema; from then on every change is a reviewed, reversible migration
   applied by `alembic upgrade head` (a PRE_DEPLOY job in prod). `create_all` is removed —
   the two must **never both** manage the schema, or they fight.

**When to bootstrap.** `create_all` is scaffolding for the earliest phase only — a single
developer, no shared/deployed environment, no data worth keeping, a schema still churning.
Switch to managed migrations as soon as any of that changes; it's cheapest against an empty
DB and only gets riskier once real data exists. The full trigger checklist and the timing
rationale live in the [`db-bootstrap.md`](../../sop/db-bootstrap.md) SOP under **"When to
run this"** — this doc doesn't repeat them.

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

1. Apply migrations up to the _previous_ revision.
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
  DB tier** (`production: true` in `.do/app.yaml`); a dev-grade tier
  (`production: false`) has no automated backups. Whether a given app's managed DB is on
  the backed-up tier yet is tracked in its instance sheet, not here.

Decide per migration which applies, and note it in the migration docstring.

## The migration test suite

The migration tests live in `backend/tests/migrations/` and drive the Alembic CLI
against a **disposable** Postgres (never a real DB — they `DROP SCHEMA`). They `skip`
unless `TEST_DATABASE_URL` is set and reachable, so the normal SQLite unit run is
unaffected. `test_migrations_match_models` (an `alembic check`) is the gate that a
migration actually matches `app/models/`; the suite implements Levels 1–2 above.

**Running them is procedure, not covered here.** There is no host
`python`/`alembic`/`psql` — everything runs inside the compose containers. For the exact
containerised commands (create a scratch DB, generate a migration, run this suite), see
the instance sheet's command reference and the [`sop/bin/db.sh`](../../sop/bin/db.sh)
wrapper; for the one-time `create_all()`→Alembic cutover, follow
[`db-bootstrap.md`](../../sop/db-bootstrap.md), and for an ongoing schema change,
[`db-change.md`](../../sop/db-change.md). This doc stays focused on _what_ the tests prove.

## Deploying migrations on DigitalOcean

Schema is applied by a PRE_DEPLOY `migrate` job (`run_command: alembic upgrade head`)
defined in `.do/app.yaml`. PRE_DEPLOY runs the migration **before** new app instances take
traffic; combined with expand/contract, that keeps deploys zero-downtime and each step
reversible, and it means the production migration is never run by hand (after initial setup).

## See also

- [`database-integration.md`](database-integration.md) — how schema changes ripple
  through the `*Out` schemas and the frontend.
- `AGENTS.md` — "enforce data integrity in app code, not DB cascades" (SQLite tests
  don't enforce FKs); migrations should still declare constraints for Postgres.
