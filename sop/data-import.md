# SOP: Bulk contact import from CSV

Loading a CSV of contacts into a running Rozetta PMS environment with
`backend/scripts/import_contacts.py`. App-specific values live in
[`instances/rozetta-pms.md`](instances/rozetta-pms.md).

## Why through the API, not the database

The other SOPs here drive Postgres directly. This one deliberately does not:

- `sop/bin/db.sh` treats the real database as **PROTECTED** and refuses writes
  against it outright.
- `AGENTS.md` — "No raw SQL — use the session from `get_db`."
- The integrity rules live in the **route handlers, not the schema**. Orphaning a
  deleted organisation's contacts is Python (`app/api/routes/organisations.py`),
  not a DB cascade. A raw `INSERT` bypasses that layer by construction.

`httpx` is already a backend runtime dependency, so the script adds nothing.

## The CSV

Headers must be **exactly** these four, in any order:

```
First Name,Last Name,Email,Organisation
```

The check is strict on purpose. `ContactCreate` silently drops unknown keys, so a
file with a single combined `Name` column would otherwise import cleanly as a set
of nameless rows. A wrong header fails loudly instead.

`Organisation` is a **name**, not an id — the script resolves it to an
`organisation_id`, creating organisations that don't exist yet.

## What the script decides

| Row                                | Outcome                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| Email already in the system        | Skipped — this is what makes a re-run safe                    |
| Email repeated within the CSV      | First kept, rest skipped                                      |
| Blank email                        | Skipped; `--allow-blank-email` imports it (undedupable)       |
| Malformed email                    | Skipped — it would 422 mid-run otherwise                      |
| Every column blank                 | Skipped — `create_contact` 422s on a contact with no details  |
| No first **or** last name          | Imported, with a warning; an email alone identifies a contact |
| Org name matching 2+ existing orgs | **Aborts the whole run**, listing the collisions              |

Organisation names match case- and whitespace-insensitively, so `Acme Corp` and
`acme  corp` are one organisation. Only names the CSV actually references are
checked for ambiguity — unrelated duplicates already in the database are left
alone.

## Getting a token

There is no headless login for production. `GET /api/auth/dev-token` exists only
when `ENABLE_DEV_LOGIN=true`, and the prod Dockerfile stage **deletes that
module** — it cannot be reached on `ims.rozettainstitute.com`.

1. Log into `https://ims.rozettainstitute.com` with your Microsoft account.
2. DevTools → Application → Local Storage → copy the `token` value.
3. `export ROZETTA_TOKEN='<paste>'`

Valid ~8h (`ACCESS_TOKEN_EXPIRE_MINUTES=480`). Creating contacts requires
`ADMIN` or `ASSESSOR`; an address in `ADMIN_EMAILS` gets `admin`.

The token comes from the environment, never a flag — a production JWT in shell
history is a credential leak.

## Procedure

Run from `backend/` (inside the container — see the instance sheet's
"Environment" section for the wrapper patterns; the host has no `python`).

### 1. Rehearse locally

```bash
docker compose up --build
TOKEN=$(curl -s localhost:8000/api/auth/dev-token | jq -r .access_token)
export ROZETTA_TOKEN="$TOKEN"           # dev-login is hardcoded on in docker-compose.yml
python -m scripts.import_contacts contacts.csv --base-url http://localhost:8000/api
python -m scripts.import_contacts contacts.csv --base-url http://localhost:8000/api --commit
```

Confirm at `localhost:5173` that the contacts show the right organisation.

### 2. Re-run the same file locally

```bash
python -m scripts.import_contacts contacts.csv --base-url http://localhost:8000/api --commit
```

**It must create nothing and skip every row.** This is the check that matters
most before touching production.

### 3. Back up production

`sop/bin/backup-db.sh` — see the instance sheet. `*.sql` dumps are gitignored and
contain production data; never commit one, and delete it once verified.

### 4. Production dry run, then commit

```bash
export ROZETTA_TOKEN='<token from the browser>'
python -m scripts.import_contacts contacts.csv \
    --base-url https://ims.rozettainstitute.com/api          # dry run (the default)
```

Read the printed plan by eye — organisations to create, contacts to create,
rows skipped by reason. Only then:

```bash
python -m scripts.import_contacts contacts.csv \
    --base-url https://ims.rozettainstitute.com/api --commit
```

`--base-url` is required with no default, so a forgotten argument can never land
on production.

### 5. Confirm by round-trip

`GET /api/reports/export/contacts` re-emits your exact four columns among its
ten, so the export can be diffed against the source CSV.

## The run log is the rollback plan

`--commit` appends every action to `import-log-<timestamp>.jsonl` in the working
directory (`--log-file` overrides):

```json
{ "action": "create-organisation", "name": "Acme Corp", "id": "…", "status": "created" }
{ "row": 2, "action": "create-contact", "id": "…", "status": "created" }
```

There is no bulk delete endpoint, so **this file is how you undo the run** — it
holds every id created. It is gitignored (it names real records); keep it until
you're satisfied with the import.

Exit codes: `0` success, `1` some rows failed (see the log), `2` aborted before
writing anything.

## Limits

- **Not safe to run concurrently.** Get-or-create on organisations is a
  read-then-write, and `organisations.name` has no unique constraint to catch a
  race. One operator, one run at a time.
- A row failure does not roll back the rows before it. The run continues and
  exits non-zero; fix the input and re-run — already-imported rows are skipped.
- Only the four columns are imported. `role`, `phone`, `linkedin`, `notes`, and
  `org_type`/`sector` on new organisations are left null for later enrichment.
