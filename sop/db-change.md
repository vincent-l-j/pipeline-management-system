# SOP: Add or change a database field

**Applies to:** any app on the standard stack once
[`db-bootstrap.md`](./db-bootstrap.md) has been completed (Alembic is the source of
truth; `create_all()` is gone; the `PRE_DEPLOY` migrate job is live).

**Use this for** every schema change: new column, new table, type change, constraint,
index, or enum value.

**Configuration comes from `.env` in the repo root.** Before running these steps, ensure
`.env` is set up — copy from `.env.example` and customize as needed.

---

## 0. Guardrails — read before running anything

1. **Echo and confirm the target before every write.** `echo "TARGET DB: $DATABASE_URL"`
   and get human confirmation before any `alembic upgrade` / `downgrade`. Apply migrations
   only against a **local or throwaway** DB in this SOP — never production by hand.
   Production migrations run automatically via the deploy's `PRE_DEPLOY` job.
2. **`[HUMAN CONFIRM]`** steps need human approval; do not self-approve.
3. **`[STOP IF ...]`** is a hard halt.
4. A generated migration is a **draft**. Autogenerate is not authoritative; the review in
   step 3 is. Never apply a migration you have not read.

---

## 1. Change the model (and schema)

1. Edit the SQLAlchemy model to add/change the field.
2. If the API should read or write it, add the matching field to the Pydantic schema in
   `backend/app/schemas/` (or your app's equivalent).

A model edit alone changes no database — it only takes effect through a migration.

---

## 2. Generate the migration (against a throwaway/local DB)

Use a local or throwaway database (never production). Override `$DATABASE_URL` from `.env`:

```bash
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/throwaway_db"
echo "TARGET DB: $DATABASE_URL"          # confirm not production
cd backend && alembic revision --autogenerate -m "short description"
```

---

## 3. Review the generated file — required

Read `upgrade()` and `downgrade()`. Autogenerate **reliably** detects table and column
add/remove and nullable changes. It is **unreliable or silent** on:

- **Column type changes** — detected only with `compare_type` and still imperfect; verify.
- **Renames** — a table or column rename is emitted as drop + add, which **destroys data**.
  Hand-edit into an `alter`/rename. `[STOP IF]` a rename appears as drop+add and the column
  holds data.
- **Constraints / server defaults / indexes** — often missed; add by hand.
- **Enum value changes** — with the enum hook installed, adding a value renders as
  `op.sync_enum_values`. Verify it is present; a bare model-enum edit with no operation
  means it was missed. Removing or reordering enum values is **not** a simple op — it
  requires recreating the type; treat as a deliberate, hand-written migration.

`[STOP IF]` you are adding a **`NOT NULL`** column to a table that has rows: a bare
`NOT NULL` add fails. Split into: add nullable (or with `server_default`) → backfill →
tighten to `NOT NULL` in a later step.

`[HUMAN CONFIRM]` the migration is correct before applying.

---

## 4. Apply and test locally

```bash
echo "TARGET DB: $DATABASE_URL"          # still the throwaway/local DB
alembic upgrade head
```

Verify:

```bash
psql "$DATABASE_URL" -c "\d $TABLE_CHANGED"    # change present?
curl "$LOCAL_HEALTH_URL"                       # app still healthy?
```

Then exercise the change through the API and add/extend a test in `$TESTS_DIR` so the
change is covered before it reaches `main`.

Note: the automated suite runs on SQLite (or another test engine), which does not have
native Postgres enum types. A migration that relies on Postgres-specific DDL must be
exercised against Postgres, not only the test suite.

---

## 5. Ship

Merge to `main`. CI GitOps triggers the `PRE_DEPLOY` migrate job, which runs
`alembic upgrade head` against the environment DB before the new release goes live. Do not
run the production migration by hand.

`[STOP IF]` the migration is destructive (drops a column/table, narrows a type) and the
target DB holds data you care about: confirm a current backup/PITR window exists first
(see [`migrations.md`](../docs/best-practices/migrations.md), "Level 4 — Rollback rehearsal").

---

## 6. Reverting

```bash
echo "TARGET DB: $DATABASE_URL"
alembic current            # where are we?
alembic history            # ordered revisions
alembic downgrade -1       # step back one
# or: alembic downgrade <revision_id>
```

- `downgrade()` only works if it was written correctly — read it, especially for anything
  beyond a plain add/drop.
- A downgrade that **drops a column deletes that column's data permanently.** `[HUMAN
CONFIRM]` before downgrading anything holding data.
- **In production, prefer a new forward migration** that corrects the mistake over a manual
  downgrade. Data already lost to a bad migration is not recovered by downgrading.

---

## 7. Done criteria

- Migration file reviewed and applied cleanly on a throwaway/local DB.
- Change covered by a test.
- Merged to `main`; deploy's migrate job applied it without error; app boots.
