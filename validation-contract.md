# Validation Contract

Mission-level correctness for one feature:

1. Delete a pitch, with a typed confirmation, cascading to its dependent records

Each entry below is a **black-box behavioural assertion** — what a real user (or,
for security assertions, a direct API client bypassing the UI) observes. They are
implementation-independent on purpose: the _how_ (endpoints, schemas, components,
unit tests) lives in `features.json`, where each feature declares which `VAL-*`
assertions it `fulfills`. These assertions are verified by fresh agents exercising
the running system, not by reading the code.

Roles: `admin`, `assessor`, `viewer`.

---

## Deleting a pitch

### VAL-PITCH-DELETE-001: Admin can delete a pitch from its detail page

From a pitch's detail page, an admin opens a "Delete" affordance, completes the
confirmation, and the pitch is removed. They are returned to the pitch list, where
the pitch no longer appears, and it is also absent from the pipeline board.
Reloading the list does not bring it back.
Tool: agent-browser
Evidence: screenshot(detail-delete-control), screenshot(list-without-pitch), screenshot(board-without-pitch), network(DELETE /api/pitches/{id} -> 200)

### VAL-PITCH-DELETE-002: Deleting requires typing the pitch's exact title

The confirmation asks the user to type the pitch's title, and the confirm control
stays inert until what they typed matches it exactly. A blank, partial or wrong
title never issues a delete request. Cancelling or dismissing the confirmation
issues no request and leaves the pitch on screen unchanged.
Tool: agent-browser
Evidence: screenshot(confirm-disabled-partial-title), screenshot(confirm-enabled-exact-title), screenshot(pitch-intact-after-cancel)

### VAL-PITCH-DELETE-003: The confirmation states what will be destroyed

Before anything is deleted, the confirmation names the pitch being deleted, reports
how many assessments and meetings will go with it, and says the action cannot be
undone. The counts shown match what the pitch's detail page lists.
Tool: agent-browser
Evidence: screenshot(confirmation-names-pitch-and-counts)

### VAL-PITCH-DELETE-004: Deleting a pitch takes its dependent records with it

A pitch with an assessment, a meeting that has attendees, stage history, a linked
contact and a file link is deleted. Afterwards none of those dependent records
remain — the meeting and its attendee entries are gone, as are the assessments,
stage history, contact links and file links. The contact, the organisation and the
users themselves survive and are still reachable. Nothing in the UI points at a
missing pitch.
Tool: agent-browser, agent-api
Evidence: screenshot(meetings-list-without-deleted-pitch), screenshot(contact-detail-intact), network(GET /api/pitches/{id} -> 404), network(GET /api/contacts/{id} -> 200)

### VAL-PITCH-DELETE-005: Deletion respects roles, server-side

A viewer and an assessor see no Delete control on a pitch's detail page, and both
can still read the pitch. The restriction holds even against a direct API call that
bypasses the UI.
Tool: agent-browser, agent-api
Evidence: screenshot(viewer-detail-no-delete), screenshot(assessor-detail-no-delete), network(DELETE /api/pitches/{id} as assessor -> 403), network(DELETE /api/pitches/{id} as viewer -> 403)

### VAL-PITCH-DELETE-006: A failed delete leaves the pitch intact

When a delete is refused or fails, the user stays where they are and is shown why —
they are not silently redirected to an empty page. The pitch is still present
afterwards and can still be opened.
Tool: agent-browser
Evidence: screenshot(delete-error-message), network(GET /api/pitches/{id} -> 200 after failed delete)

---

## Cross-cutting

### VAL-CROSS-001: Privileged actions are enforced on the server, not just hidden in the UI

For the restricted action here (delete a pitch), performing it via a direct API call
while authenticated as an assessor or a viewer is rejected with 403 — the hidden UI
control is never the only barrier.
Tool: agent-api
Evidence: network(DELETE /api/pitches/{id} as assessor -> 403), network(DELETE /api/pitches/{id} as viewer -> 403)
