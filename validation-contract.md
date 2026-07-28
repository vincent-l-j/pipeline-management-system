# Validation Contract

Mission-level correctness for four features:

1. Amend an assessment by creating a new version (prior versions preserved)
2. Searching for a pitch and selecting it opens that pitch (not the dashboard)
3. Edit an existing contact
4. Edit an existing organisation

Each entry below is a **black-box behavioural assertion** — what a real user (or,
for security assertions, a direct API client bypassing the UI) observes. They are
implementation-independent on purpose: the *how* (endpoints, schemas, components,
unit tests) lives in `features.json`, where each feature declares which `VAL-*`
assertions it `fulfills`. These assertions are verified by fresh agents exercising
the running system, not by reading the code.

Roles: `admin`, `assessor`, `viewer`.

---

## Amending assessments

### VAL-ASSESS-001: Admin/assessor can amend an assessment via a new version

Starting from a pitch that already has an assessment, an admin or assessor uses an
"amend" / "new assessment" affordance, adjusts the criteria scores and/or
recommendation, and saves. A new assessment is stored for that pitch with its
version number incremented (the previous latest was version N; the amendment is
version N+1), and the newly saved values are shown.
Tool: agent-browser
Evidence: screenshot(new-version-form), screenshot(detail-shows-incremented-version), network(POST /api/assessments -> 200 with version = previous + 1)

### VAL-ASSESS-002: Amending never overwrites a prior version

After an assessment is amended, the earlier version still exists and is still
readable with its own original scores, recommendation, assessor and date — the
amendment adds a version rather than mutating the old record. There is no way to
edit a past version in place.
Tool: agent-browser, agent-api
Evidence: screenshot(prior-version-detail-unchanged), network(GET /api/assessments/{prior_id} -> 200 with original scores intact)

### VAL-ASSESS-003: A new version records its own assessor and date

The amended (latest) version is attributed to the user who saved it and carries its
own assessment date, independently of who authored the prior version.
Tool: agent-browser
Evidence: screenshot(version-attribution), network(POST /api/assessments -> 200 with assessor_id = acting user)

### VAL-ASSESS-004: The assessments list shows only the latest version, but history is archived and accessible

On the assessments list, each pitch appears once, showing its latest assessment version (amending a pitch's assessment updates that row in-place). The prior versions are not shown in the list but are fully preserved; on a pitch's detail view, every version is listed (newest to oldest), the current version is identifiable as the latest, and any prior version can be opened and read.
Tool: agent-browser
Evidence: screenshot(assessments-list-shows-latest-only), screenshot(version-history-list-on-detail), screenshot(opened-prior-version)

### VAL-ASSESS-005: Amendment respects roles, server-side

A viewer sees no control to create or amend an assessment and can still read
assessments and their history. The restriction holds against a direct API call that
bypasses the UI.
Tool: agent-browser, agent-api
Evidence: screenshot(viewer-no-amend-control), network(POST /api/assessments as viewer -> 403), network(GET /api/assessments as viewer -> 200)

### VAL-ASSESS-006: Invalid scores are rejected

Saving an assessment with a criterion score outside the allowed 1–5 range is
rejected and no new version is created.
Tool: agent-api
Evidence: network(POST /api/assessments with a score of 0 or 6 -> 422), network(GET /api/assessments?pitch_id={id} -> 200 with version count unchanged)

### VAL-ASSESS-007: The assessments list shows only the latest version per pitch

On the `/assessments` list view, each pitch with assessments is shown exactly once,
displaying its latest assessment version. Historical versions are not visible in the
list (but remain visible and readable in the pitch detail view's version history).
Tool: agent-browser
Evidence: screenshot(assessments-list-one-per-pitch), network(GET /api/assessments -> 200 with one entry per pitch containing only latest version)

---

## Searching for a pitch

### VAL-SEARCH-001: Selecting a pitch search result opens that pitch

A user searches (term matching a pitch), sees the pitch in the results, and clicks
it. The app navigates to that pitch's detail page (`/pitches/{id}`) showing the
matched pitch — **not** the dashboard / home page.
Tool: agent-browser
Evidence: screenshot(search-results-with-pitch), screenshot(pitch-detail-open), url(/pitches/{id})

### VAL-SEARCH-002: Every result type routes to its own detail page

Selecting a result of any type navigates to the correct detail route for that type
— pitch → `/pitches/{id}`, organisation → `/organisations/{id}`, contact →
`/contacts/{id}`, meeting → `/meetings/{id}`, assessment → `/assessments/{id}` — and
none of them fall through to the dashboard.
Tool: agent-browser
Evidence: screenshot(organisation-result-opens-org), screenshot(contact-result-opens-contact), screenshot(no-result-type-lands-on-dashboard)

---

## Editing an existing contact

### VAL-CON-EDIT-001: Admin/assessor can edit an existing contact

From the contacts list (or a contact's view), an admin or assessor opens an "Edit"
affordance, the form is pre-filled with the contact's current values, they change a
field (e.g. name, role or email), save, and the updated value is shown without a
reload.
Tool: agent-browser
Evidence: screenshot(edit-form-prefilled), screenshot(contact-updated), network(PATCH /api/contacts/{id} -> 200)

### VAL-CON-EDIT-002: Editing a contact is a partial update

Saving an edit that changes one field leaves the contact's other fields (e.g.
phone, notes, linked organisation) intact — only the changed fields are altered.
Tool: agent-api
Evidence: network(PATCH /api/contacts/{id} with one field -> 200), network(GET /api/contacts/{id} -> 200 with untouched fields preserved)

### VAL-CON-EDIT-003: Contact editing respects roles, server-side

A viewer sees no Edit control and cannot edit a contact. The restriction holds
against a direct API call that bypasses the UI.
Tool: agent-browser, agent-api
Evidence: screenshot(viewer-no-edit-control), network(PATCH /api/contacts/{id} as viewer -> 403)

---

## Creating an organisation

### VAL-ORG-CREATE-001: Admin/assessor can create an organisation with all fields

From the organisations list, an admin or assessor clicks "Add Organisation", the form
includes fields for name (required), org_type, sector, state_territory, website, abn,
and notes (all optional), fills in any combination of fields, saves, and the new
organisation is created and appears in the list with all supplied values set.
Tool: agent-browser
Evidence: screenshot(add-form-with-all-fields), screenshot(organisation-created), network(POST /api/organisations -> 201 with all supplied fields persisted)

### VAL-ORG-CREATE-002: Creating an organisation accepts all optional fields

Posting to POST /api/organisations with org_type, sector, state_territory, website,
abn, or notes creates the organisation with those fields set; omitting them stores
them as null.
Tool: agent-api
Evidence: network(POST /api/organisations with org_type and state_territory -> 201), network(GET /api/organisations/{id} -> 200 with those fields set)

### VAL-ORG-CREATE-003: Organisation creation respects roles, server-side

A viewer sees no Add control and cannot create an organisation. The restriction holds
against a direct API call that bypasses the UI.
Tool: agent-browser, agent-api
Evidence: screenshot(viewer-no-add-control), network(POST /api/organisations as viewer -> 403)

---

## Editing an existing organisation

### VAL-ORG-EDIT-001: Admin/assessor can edit an existing organisation

From the organisations list (or an organisation's view), an admin or assessor opens
an "Edit" affordance, the form is pre-filled with the organisation's current values
for all fields (name, org_type, sector, state_territory, website, abn, notes), they
change any field(s), save, and the updated values are shown without a reload.
Tool: agent-browser
Evidence: screenshot(edit-form-prefilled-all-fields), screenshot(organisation-updated), network(PATCH /api/organisations/{id} -> 200)

### VAL-ORG-EDIT-002: Editing an organisation is a partial update

Saving an edit that changes one field leaves the organisation's other fields intact
— only the changed fields are altered.
Tool: agent-api
Evidence: network(PATCH /api/organisations/{id} with one field -> 200), network(GET /api/organisations/{id} -> 200 with untouched fields preserved)

### VAL-ORG-EDIT-003: Organisation editing respects roles, server-side

A viewer sees no Edit control and cannot edit an organisation. The restriction holds
against a direct API call that bypasses the UI.
Tool: agent-browser, agent-api
Evidence: screenshot(viewer-no-edit-control), network(PATCH /api/organisations/{id} as viewer -> 403)

---

## Cross-cutting

### VAL-CROSS-001: Privileged actions are enforced on the server, not just hidden in the UI

For every restricted action here (amend an assessment, edit a contact, edit an
organisation), performing it via a direct API call while authenticated as a viewer
is rejected with 403 — the hidden/disabled UI is never the only barrier.
Tool: agent-api
Evidence: network(POST /api/assessments as viewer -> 403), network(PATCH /api/contacts/{id} as viewer -> 403), network(PATCH /api/organisations/{id} as viewer -> 403)
