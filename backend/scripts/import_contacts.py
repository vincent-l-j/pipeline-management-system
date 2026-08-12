"""Import contacts from a CSV into Rozetta PMS through the public API.

    ROZETTA_TOKEN=<jwt> python -m scripts.import_contacts contacts.csv \
        --base-url https://ims.rozettainstitute.com/api            # dry run
    ROZETTA_TOKEN=<jwt> python -m scripts.import_contacts contacts.csv \
        --base-url https://ims.rozettainstitute.com/api --commit   # writes

The API is the only sanctioned write path: the integrity rules live in the route
handlers rather than the schema (orphaning a deleted organisation's children is
Python, not a DB cascade), so a raw INSERT would bypass them by construction.

Two things the API does not do, which this script therefore must:

* `organisations.name` has no unique constraint and there is no name-filtered
  list endpoint, so get-or-create runs client-side against a pre-fetched index.
* `contacts` has no unique constraint either and `create_contact` is a bare
  passthrough, so re-running an import would silently duplicate every row.
  Deduplication keys off the email address.

Not idempotent across *concurrent* runs: get-or-create on organisations is a
read-then-write with no unique constraint to catch a race. Don't run two copies
at once.
"""

import argparse
import csv
import json
import os
import re
import sys
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import TextIO

import httpx
from pydantic import EmailStr, TypeAdapter, ValidationError

TOKEN_ENV_VAR = "ROZETTA_TOKEN"

CSV_HEADERS = ("First Name", "Last Name", "Email", "Organisation")
_FIELD_BY_HEADER = {
    "First Name": "first_name",
    "Last Name": "last_name",
    "Email": "email",
    "Organisation": "organisation",
}

EXIT_OK = 0
EXIT_FAILURES = 1
EXIT_ABORT = 2

_WHITESPACE = re.compile(r"\s+")
# The same EmailStr ContactCreate uses, so a row that would 422 mid-run is caught
# before the run starts.
_EMAIL = TypeAdapter(EmailStr)


class ImportAbortError(Exception):
    """The run must not proceed: a bad header row, or an organisation name that
    cannot be resolved to exactly one id."""


class SkipReason(StrEnum):
    EMPTY_ROW = "empty-row"
    BLANK_EMAIL = "blank-email"
    MALFORMED_EMAIL = "malformed-email"
    DUPLICATE_IN_FILE = "duplicate-in-file"
    ALREADY_EXISTS = "already-exists"


@dataclass(frozen=True)
class CsvRow:
    line: int
    first_name: str | None
    last_name: str | None
    email: str | None
    organisation: str | None

    @property
    def is_empty(self) -> bool:
        return not any((self.first_name, self.last_name, self.email, self.organisation))


@dataclass(frozen=True)
class SkippedRow:
    line: int
    reason: SkipReason
    detail: str


@dataclass(frozen=True)
class RowNote:
    line: int
    message: str


@dataclass(frozen=True)
class PlannedContact:
    line: int
    first_name: str | None
    last_name: str | None
    email: str | None
    organisation: str | None
    organisation_key: str | None

    def payload(self, org_ids: Mapping[str, str]) -> dict:
        """The `POST /api/contacts` body. Blank cells are omitted rather than sent
        as explicit nulls — every ContactCreate field already defaults to None."""
        body = {
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
        }
        if self.organisation_key is not None:
            body["organisation_id"] = org_ids[self.organisation_key]
        return {name: value for name, value in body.items() if value is not None}


@dataclass
class ImportPlan:
    orgs_to_create: list[str]
    contacts: list[PlannedContact]
    skipped: list[SkippedRow]
    warnings: list[RowNote]
    org_ids: dict[str, str] = field(default_factory=dict)


def normalise(name: str) -> str:
    """Fold an organisation name to a match key: case- and whitespace-insensitive."""
    return _WHITESPACE.sub(" ", name).strip().casefold()


# --- parsing ----------------------------------------------------------------


def parse_csv(handle: TextIO) -> list[CsvRow]:
    reader = csv.DictReader(handle)
    _validate_headers(reader)
    return [
        CsvRow(
            line=reader.line_num,
            **{name: _clean(raw.get(header)) for header, name in _FIELD_BY_HEADER.items()},
        )
        for raw in reader
    ]


def parse_csv_file(path: Path) -> list[CsvRow]:
    # utf-8-sig strips the BOM Excel writes; newline="" lets csv handle quoted
    # fields that span lines.
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return parse_csv(handle)


def _validate_headers(reader: csv.DictReader) -> None:
    """A strict header check is what turns silent data loss into a loud failure:
    ContactCreate drops unknown keys without erroring, so a CSV carrying a single
    combined `Name` column would otherwise import a file full of nameless rows."""
    if reader.fieldnames is None:
        raise ImportAbortError("the CSV is empty — no header row found")

    reader.fieldnames = [(name or "").lstrip("﻿").strip() for name in reader.fieldnames]
    missing = sorted(set(CSV_HEADERS) - set(reader.fieldnames))
    unexpected = sorted(set(reader.fieldnames) - set(CSV_HEADERS))
    if not missing and not unexpected:
        return

    problems = []
    if missing:
        problems.append(f"missing {', '.join(missing)}")
    if unexpected:
        problems.append(f"unexpected {', '.join(unexpected)}")
    raise ImportAbortError(
        f"CSV headers must be exactly {', '.join(CSV_HEADERS)} — {'; '.join(problems)}"
    )


def _clean(value: str | None) -> str | None:
    return (value or "").strip() or None


# --- planning ---------------------------------------------------------------


class _OrgResolver:
    """Client-side get-or-create for organisations.

    A name matching two or more existing organisations is never guessed at —
    picking a duplicate on the operator's behalf is not a decision a script gets
    to make silently, so the whole run aborts. Only names the CSV actually
    references are checked; unrelated duplicates already in the database are not
    this import's problem.
    """

    def __init__(self, index: Mapping[str, list[dict]]):
        self._index = index
        self._pending: set[str] = set()
        self._ambiguous: dict[str, list[dict]] = {}
        self.org_ids: dict[str, str] = {}
        self.to_create: list[str] = []

    def key_for(self, name: str | None) -> str | None:
        if name is None:
            return None
        key = normalise(name)
        if key in self.org_ids or key in self._pending:
            return key

        matches = self._index.get(key, [])
        if len(matches) > 1:
            self._ambiguous[key] = matches
        elif matches:
            self.org_ids[key] = str(matches[0]["id"])
        else:
            self._pending.add(key)
            self.to_create.append(name)
        return key

    def raise_if_ambiguous(self) -> None:
        if not self._ambiguous:
            return
        collisions = "\n".join(
            "  {!r} matches {} organisations: {}".format(
                key,
                len(matches),
                ", ".join(f'{match["id"]} ("{match["name"]}")' for match in matches),
            )
            for key, matches in sorted(self._ambiguous.items())
        )
        raise ImportAbortError(
            "ambiguous organisation names — merge or rename the duplicates in the "
            f"app, then re-run:\n{collisions}"
        )


def plan_import(
    rows: Iterable[CsvRow],
    *,
    organisations: Iterable[Mapping],
    contacts: Iterable[Mapping],
    allow_blank_email: bool = False,
) -> ImportPlan:
    """Decide what to create and what to skip. Pure — no I/O, no network."""
    resolver = _OrgResolver(_index_organisations(organisations))
    existing_emails = {
        email.casefold() for c in contacts if (email := (c.get("email") or "").strip())
    }
    file_emails: set[str] = set()

    planned: list[PlannedContact] = []
    skipped: list[SkippedRow] = []
    warnings: list[RowNote] = []

    for row in rows:
        skip = _classify(row, existing_emails, file_emails, allow_blank_email)
        if skip is not None:
            skipped.append(skip)
            continue
        if row.email:
            file_emails.add(row.email.casefold())
        if row.first_name is None and row.last_name is None:
            warnings.append(RowNote(row.line, "no name — the row is identified by email alone"))
        planned.append(
            PlannedContact(
                line=row.line,
                first_name=row.first_name,
                last_name=row.last_name,
                email=row.email,
                organisation=row.organisation,
                organisation_key=resolver.key_for(row.organisation),
            )
        )

    # After the full scan, so the operator sees every collision at once.
    resolver.raise_if_ambiguous()
    return ImportPlan(
        orgs_to_create=resolver.to_create,
        contacts=planned,
        skipped=skipped,
        warnings=warnings,
        org_ids=resolver.org_ids,
    )


def _classify(
    row: CsvRow,
    existing_emails: set[str],
    file_emails: set[str],
    allow_blank_email: bool,
) -> SkippedRow | None:
    if row.is_empty:
        # create_contact 422s on Contact.is_blank.
        return SkippedRow(row.line, SkipReason.EMPTY_ROW, "every column is blank")
    if row.email is None:
        if allow_blank_email:
            return None
        return SkippedRow(row.line, SkipReason.BLANK_EMAIL, "no address to deduplicate on")
    if not _is_valid_email(row.email):
        return SkippedRow(row.line, SkipReason.MALFORMED_EMAIL, row.email)

    key = row.email.casefold()
    if key in existing_emails:
        return SkippedRow(row.line, SkipReason.ALREADY_EXISTS, row.email)
    if key in file_emails:
        return SkippedRow(row.line, SkipReason.DUPLICATE_IN_FILE, row.email)
    return None


def _index_organisations(organisations: Iterable[Mapping]) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = {}
    for organisation in organisations:
        index.setdefault(normalise(organisation["name"]), []).append(dict(organisation))
    return index


def _is_valid_email(value: str) -> bool:
    try:
        _EMAIL.validate_python(value)
    except ValidationError:
        return False
    return True


# --- API client -------------------------------------------------------------


class ApiClient:
    """Thin wrapper over the REST API.

    No trailing slashes on any path: `redirect_slashes=False` in `app/main.py`
    means `/contacts/` 404s rather than redirecting, and follow_redirects stays
    off so a stray 307 surfaces instead of being silently followed.
    """

    def __init__(self, base_url: str, token: str, timeout: float = 30.0):
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {token}"},
            follow_redirects=False,
            timeout=timeout,
        )

    def __enter__(self) -> "ApiClient":
        return self

    def __exit__(self, *exc_info) -> None:
        self._client.close()

    def list_organisations(self) -> list[dict]:
        return self._request("GET", "/organisations")

    def list_contacts(self) -> list[dict]:
        return self._request("GET", "/contacts")

    def create_organisation(self, name: str) -> dict:
        # Only `name` is required; org_type/sector are left null for later enrichment.
        return self._request("POST", "/organisations", {"name": name})

    def create_contact(self, payload: Mapping) -> dict:
        return self._request("POST", "/contacts", payload)

    def _request(self, method: str, path: str, body: Mapping | None = None):
        response = self._client.request(method, path, json=body)
        response.raise_for_status()
        return response.json()


class JsonlLog:
    """Append-only record of everything the run created. There is no bulk delete
    endpoint, so this file is the rollback plan — it holds every id produced."""

    def __init__(self, path: Path):
        self.path = path
        self._handle = path.open("a", encoding="utf-8")

    def __enter__(self) -> "JsonlLog":
        return self

    def __exit__(self, *exc_info) -> None:
        self._handle.close()

    def write(self, **record) -> None:
        self._handle.write(json.dumps(record, default=str) + "\n")
        self._handle.flush()  # a crash mid-run must not lose the ids already created


# --- reporting and execution ------------------------------------------------


def report(plan: ImportPlan) -> None:
    print(f"Organisations to create: {len(plan.orgs_to_create)}")
    for name in plan.orgs_to_create:
        print(f"  + {name}")

    print(f"Contacts to create: {len(plan.contacts)}")
    print(f"Rows skipped: {len(plan.skipped)}")
    for reason in SkipReason:
        rows = [skip for skip in plan.skipped if skip.reason is reason]
        if rows:
            print(f"  {reason.value}: {len(rows)} (lines {_line_list(rows)})")

    for note in plan.warnings:
        print(f"  warning: line {note.line} — {note.message}")


def _line_list(rows: list[SkippedRow], limit: int = 10) -> str:
    lines = [str(row.line) for row in rows]
    if len(lines) <= limit:
        return ", ".join(lines)
    return f"{', '.join(lines[:limit])}, … and {len(lines) - limit} more"


def execute(plan: ImportPlan, api: ApiClient, log: JsonlLog) -> int:
    """Create organisations first — the contacts need their ids. A row that fails
    is recorded and the run continues; the count comes back for the exit code."""
    return _create_organisations(plan, api, log) + _create_contacts(plan, api, log)


def _create_organisations(plan: ImportPlan, api: ApiClient, log: JsonlLog) -> int:
    failures = 0
    for name in plan.orgs_to_create:
        try:
            created = api.create_organisation(name)
        except httpx.HTTPError as exc:
            failures += 1
            log.write(action="create-organisation", name=name, status="failed", error=str(exc))
            print(f"  failed to create organisation {name!r}: {exc}", file=sys.stderr)
            continue
        plan.org_ids[normalise(name)] = str(created["id"])
        log.write(action="create-organisation", name=name, id=created["id"], status="created")
    return failures


def _create_contacts(plan: ImportPlan, api: ApiClient, log: JsonlLog) -> int:
    failures = 0
    for planned in plan.contacts:
        key = planned.organisation_key
        if key is not None and key not in plan.org_ids:
            failures += 1
            log.write(
                row=planned.line,
                action="create-contact",
                status="skipped",
                error=f"organisation {planned.organisation!r} was not created",
            )
            continue
        try:
            created = api.create_contact(planned.payload(plan.org_ids))
        except httpx.HTTPError as exc:
            failures += 1
            log.write(row=planned.line, action="create-contact", status="failed", error=str(exc))
            print(f"  failed to create contact on line {planned.line}: {exc}", file=sys.stderr)
            continue
        log.write(row=planned.line, action="create-contact", id=created["id"], status="created")
    return failures


# --- entry point ------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.import_contacts",
        description="Import contacts from a CSV via the Rozetta PMS API.",
        epilog=(
            f"The bearer token comes from ${TOKEN_ENV_VAR}, never a flag — a "
            "production JWT in shell history is a credential leak."
        ),
    )
    parser.add_argument("csv_path", type=Path, help=f"CSV with columns: {', '.join(CSV_HEADERS)}")
    parser.add_argument(
        "--base-url",
        required=True,
        help=(
            "API root, e.g. http://localhost:8000/api. Required with no default, "
            "so a forgotten argument can never land on production."
        ),
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually write. Without it the run is a dry run that stops after the report.",
    )
    parser.add_argument(
        "--allow-blank-email",
        action="store_true",
        help=(
            "Import rows with no email. They cannot be deduplicated, so a re-run "
            "will create them a second time."
        ),
    )
    parser.add_argument(
        "--log-file",
        type=Path,
        help="Where to append the JSONL record (default: ./import-log-<timestamp>.jsonl).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    token = os.environ.get(TOKEN_ENV_VAR)
    if not token:
        print(f"{TOKEN_ENV_VAR} is not set — export the bearer token first.", file=sys.stderr)
        return EXIT_ABORT

    with ApiClient(args.base_url, token) as api:
        try:
            rows = parse_csv_file(args.csv_path)
            plan = plan_import(
                rows,
                organisations=api.list_organisations(),
                contacts=api.list_contacts(),
                allow_blank_email=args.allow_blank_email,
            )
        except ImportAbortError as exc:
            print(f"Aborted: {exc}", file=sys.stderr)
            return EXIT_ABORT
        except httpx.HTTPError as exc:
            print(f"Aborted: could not read current state — {exc}", file=sys.stderr)
            return EXIT_ABORT

        print(f"Read {len(rows)} rows from {args.csv_path}\n")
        report(plan)

        if not args.commit:
            print("\nDry run — nothing was written. Re-run with --commit to apply.")
            return EXIT_OK

        log_path = args.log_file or _default_log_path()
        print(f"\nWriting to {args.base_url} — logging to {log_path}")
        with JsonlLog(log_path) as log:
            failures = execute(plan, api, log)

    if failures:
        print(f"\nDone with {failures} failure(s) — see {log_path}", file=sys.stderr)
        return EXIT_FAILURES
    print(f"\nDone. {len(plan.contacts)} contacts created; ids recorded in {log_path}")
    return EXIT_OK


def _default_log_path() -> Path:
    return Path(f"import-log-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.jsonl")


if __name__ == "__main__":
    sys.exit(main())
