"""Tests for the CSV contact importer's pure layers — no network, no DB.

Everything the importer decides (what to create, what to skip, what to abort on)
happens in `parse_csv` and `plan_import`. Those are the only things tested here;
the httpx layer is a thin caller of them.
"""

import io

import pytest

from scripts.import_contacts import (
    ImportAbortError,
    SkipReason,
    normalise,
    parse_csv,
    plan_import,
)

HEADER = "First Name,Last Name,Email,Organisation"


def csv_text(*rows: str) -> io.StringIO:
    return io.StringIO("\n".join([HEADER, *rows]) + "\n")


def org(org_id: str, name: str) -> dict:
    """An organisation as `GET /api/organisations` returns it (extra keys included,
    so the parser is exercised against the real response shape)."""
    return {"id": org_id, "name": name, "org_type": None, "sector": None}


def contact(contact_id: str, email: str | None) -> dict:
    return {"id": contact_id, "email": email, "first_name": "X", "last_name": "Y"}


def plan(*rows: str, organisations=(), contacts=(), **kwargs):
    return plan_import(
        parse_csv(csv_text(*rows)),
        organisations=list(organisations),
        contacts=list(contacts),
        **kwargs,
    )


def reasons(result) -> list[SkipReason]:
    return [skip.reason for skip in result.skipped]


# --- header validation ------------------------------------------------------


def test_exact_headers_parse():
    rows = parse_csv(csv_text("Ada,Lovelace,ada@example.com,Analytical Engines"))

    assert len(rows) == 1
    assert rows[0].first_name == "Ada"
    assert rows[0].last_name == "Lovelace"
    assert rows[0].email == "ada@example.com"
    assert rows[0].organisation == "Analytical Engines"


def test_header_order_does_not_matter():
    handle = io.StringIO("Email,Organisation,First Name,Last Name\na@example.com,Acme,Ada,L\n")

    rows = parse_csv(handle)

    assert rows[0].first_name == "Ada"
    assert rows[0].email == "a@example.com"


def test_missing_header_aborts_naming_the_column():
    handle = io.StringIO("First Name,Last Name,Email\nAda,Lovelace,ada@example.com\n")

    with pytest.raises(ImportAbortError) as excinfo:
        parse_csv(handle)

    assert "Organisation" in str(excinfo.value)


def test_unexpected_header_aborts_naming_the_column():
    handle = io.StringIO(f"{HEADER},Phone\nAda,Lovelace,ada@example.com,Acme,555\n")

    with pytest.raises(ImportAbortError) as excinfo:
        parse_csv(handle)

    assert "Phone" in str(excinfo.value)


def test_empty_file_aborts():
    with pytest.raises(ImportAbortError):
        parse_csv(io.StringIO(""))


def test_utf8_bom_does_not_break_the_first_header():
    """Excel writes a BOM; without stripping it the first column reads as
    '﻿First Name' and every row would look header-invalid."""
    handle = io.StringIO(f"﻿{HEADER}\nAda,Lovelace,ada@example.com,Acme\n")

    assert parse_csv(handle)[0].first_name == "Ada"


def test_whitespace_is_stripped_and_blanks_become_none():
    rows = parse_csv(csv_text("  Ada  ,,  ada@example.com ,   "))

    assert rows[0].first_name == "Ada"
    assert rows[0].last_name is None
    assert rows[0].email == "ada@example.com"
    assert rows[0].organisation is None


# --- normalise --------------------------------------------------------------


def test_normalise_collapses_case_and_internal_whitespace():
    assert normalise("  Acme  Corp ") == normalise("acme corp")


def test_normalise_keeps_distinct_names_distinct():
    assert normalise("Acme Corp") != normalise("Acme Corporation")


# --- contact dedupe ---------------------------------------------------------


def test_existing_email_is_skipped_not_created():
    result = plan(
        "Ada,Lovelace,ada@example.com,Acme",
        contacts=[contact("c1", "ada@example.com")],
    )

    assert result.contacts == []
    assert reasons(result) == [SkipReason.ALREADY_EXISTS]


def test_existing_email_match_ignores_case():
    result = plan(
        "Ada,Lovelace,ADA@Example.COM,Acme",
        contacts=[contact("c1", "ada@example.com")],
    )

    assert reasons(result) == [SkipReason.ALREADY_EXISTS]


def test_duplicate_email_within_the_file_keeps_the_first():
    result = plan(
        "Ada,Lovelace,ada@example.com,Acme",
        "Ada,L,ada@example.com,Acme",
    )

    assert [c.last_name for c in result.contacts] == ["Lovelace"]
    assert reasons(result) == [SkipReason.DUPLICATE_IN_FILE]


def test_malformed_email_is_skipped():
    result = plan("Ada,Lovelace,not-an-email,Acme")

    assert result.contacts == []
    assert reasons(result) == [SkipReason.MALFORMED_EMAIL]


def test_blank_email_is_skipped_by_default():
    result = plan("Ada,Lovelace,,Acme")

    assert result.contacts == []
    assert reasons(result) == [SkipReason.BLANK_EMAIL]


def test_blank_email_is_inserted_under_allow_blank_email():
    result = plan("Ada,Lovelace,,Acme", allow_blank_email=True)

    assert len(result.contacts) == 1
    assert result.contacts[0].email is None
    assert result.skipped == []


def test_blank_emails_do_not_deduplicate_against_each_other():
    """Two nameless-but-distinct people can share 'no email'; dedupe keys off the
    address, so an absent one must never collapse two rows into one."""
    result = plan("Ada,Lovelace,,Acme", "Grace,Hopper,,Acme", allow_blank_email=True)

    assert len(result.contacts) == 2


def test_existing_contacts_without_an_email_do_not_collide():
    result = plan(
        "Ada,Lovelace,,Acme",
        contacts=[contact("c1", None), contact("c2", None)],
        allow_blank_email=True,
    )

    assert len(result.contacts) == 1


# --- rows the API would reject ----------------------------------------------


def test_completely_empty_row_is_skipped():
    """`create_contact` 422s when every field is blank (`Contact.is_blank`), so an
    empty row is caught locally rather than mid-run."""
    result = plan(",,,", allow_blank_email=True)

    assert result.contacts == []
    assert reasons(result) == [SkipReason.EMPTY_ROW]


def test_nameless_row_is_created_but_warned_about():
    """Both name fields are nullable and an email alone identifies a contact, so
    this is a warning, not a skip."""
    result = plan(",,ada@example.com,Acme")

    assert len(result.contacts) == 1
    assert [w.line for w in result.warnings] == [2]


# --- organisation get-or-create --------------------------------------------


def test_new_org_is_created_once_however_many_contacts_share_it():
    result = plan(
        "Ada,Lovelace,ada@example.com,Acme Corp",
        "Grace,Hopper,grace@example.com,acme  corp",
        "Alan,Turing,alan@example.com,ACME CORP",
    )

    assert result.orgs_to_create == ["Acme Corp"]
    assert len({c.organisation_key for c in result.contacts}) == 1


def test_existing_org_is_reused_and_nothing_is_created():
    result = plan(
        "Ada,Lovelace,ada@example.com,  ACME   corp ",
        organisations=[org("o1", "Acme Corp")],
    )

    assert result.orgs_to_create == []
    assert result.org_ids[result.contacts[0].organisation_key] == "o1"


def test_contact_without_an_organisation_has_no_org_link():
    result = plan("Ada,Lovelace,ada@example.com,")

    assert result.orgs_to_create == []
    assert result.contacts[0].organisation_key is None


def test_two_existing_orgs_normalising_alike_abort_the_run():
    with pytest.raises(ImportAbortError) as excinfo:
        plan(
            "Ada,Lovelace,ada@example.com,Acme Corp",
            organisations=[org("o1", "Acme Corp"), org("o2", "  acme   corp ")],
        )

    message = str(excinfo.value)
    assert "o1" in message and "o2" in message


def test_an_unreferenced_ambiguous_org_does_not_abort():
    """Pre-existing duplicates elsewhere in the database are not this import's
    problem — only a name the CSV actually asks us to resolve is."""
    result = plan(
        "Ada,Lovelace,ada@example.com,Widgets",
        organisations=[org("o1", "Acme Corp"), org("o2", "acme corp"), org("o3", "Widgets")],
    )

    assert result.org_ids[result.contacts[0].organisation_key] == "o3"


def test_ambiguity_is_reported_for_every_colliding_name_at_once():
    with pytest.raises(ImportAbortError) as excinfo:
        plan(
            "Ada,Lovelace,ada@example.com,Acme",
            "Grace,Hopper,grace@example.com,Widgets",
            organisations=[
                org("o1", "Acme"),
                org("o2", "acme"),
                org("o3", "Widgets"),
                org("o4", "widgets"),
            ],
        )

    message = str(excinfo.value)
    assert "Acme" in message and "Widgets" in message


# --- payload ----------------------------------------------------------------


def test_payload_carries_snake_case_api_fields_and_the_resolved_org_id():
    result = plan(
        "Ada,Lovelace,ada@example.com,Acme",
        organisations=[org("o1", "Acme")],
    )

    assert result.contacts[0].payload(result.org_ids) == {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "ada@example.com",
        "organisation_id": "o1",
    }


def test_payload_omits_fields_the_row_left_blank():
    """`ContactCreate` is an allowlist of optional fields; sending explicit nulls
    would be noise, so absent values are simply not sent."""
    result = plan("Ada,,ada@example.com,")

    assert result.contacts[0].payload(result.org_ids) == {
        "first_name": "Ada",
        "email": "ada@example.com",
    }


def test_skips_record_the_source_line_for_the_operator():
    result = plan(
        "Ada,Lovelace,ada@example.com,Acme",
        "Grace,Hopper,not-an-email,Acme",
    )

    assert [s.line for s in result.skipped] == [3]
