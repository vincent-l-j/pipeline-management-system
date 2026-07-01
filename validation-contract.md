# Validation Contract

Mission-level correctness for four features:

1. Add / remove organisations & contacts (with orphaning of references)
2. Edit an existing pitch
3. Edit a pitch's pipeline stage by right-clicking its Kanban card
4. Non-admins cannot access user management

Each entry below is a **black-box behavioural assertion** — what a real user (or,
for security assertions, a direct API client bypassing the UI) observes. They are
implementation-independent on purpose: the *how* (endpoints, schemas, components,
unit tests) lives in `features.json`, where each feature declares which `VAL-*`
assertions it `fulfills`. These assertions are verified by fresh agents exercising
the running system, not by reading the code.

Roles: `admin`, `assessor`, `viewer`.

---

## Organisations & Contacts

### VAL-ORG-001: Admin/assessor can add an organisation

On the Organisations page, an admin or assessor uses an "Add" control, enters a
name, and submits. The new organisation appears in the list without a reload.
Tool: agent-browser
Evidence: screenshot(list-before), screenshot(list-after), network(POST /api/organisations -> 200)

### VAL-ORG-002: Admin can remove an organisation

An admin uses a per-row "Remove" control, confirms, and the organisation
disappears from the list. Reloading the page does not bring it back.
Tool: agent-browser
Evidence: screenshot(after-remove), network(DELETE /api/organisations/{id} -> 200)

### VAL-ORG-003: Removing an organisation orphans its references, not its children

A contact and a pitch are linked to an organisation. After the organisation is
removed, the contact and the pitch still exist and are now shown with no
organisation (the link is cleared, the records survive).
Tool: agent-browser
Evidence: screenshot(contact-detail-no-org), screenshot(pitch-detail-no-org), network(GET /api/contacts/{id} -> 200 with null organisation)

### VAL-ORG-004: Organisation add/remove respects roles, server-side

A viewer sees no Add or Remove controls (read-only list). An assessor can Add but
sees no Remove control. The restriction holds even against a direct API call that
bypasses the UI.
Tool: agent-browser, agent-api
Evidence: screenshot(viewer-readonly), screenshot(assessor-no-remove), network(DELETE /api/organisations/{id} as assessor -> 403), network(POST /api/organisations as viewer -> 403)

### VAL-CON-001: Admin/assessor can add a contact

On the Contacts page, an admin or assessor adds a contact via an "Add" control and
it appears in the list without a reload.
Tool: agent-browser
Evidence: screenshot(list-after), network(POST /api/contacts -> 200)

### VAL-CON-002: Removing a contact unlinks it cleanly, with no dangling references

A contact is linked to a pitch and is an attendee of a meeting. After an admin
removes the contact, the contact is gone, but the pitch and the meeting still
exist and simply no longer reference that contact — nothing in the UI points at a
missing person.
Tool: agent-browser
Evidence: screenshot(pitch-detail-without-contact), screenshot(meeting-detail-without-attendee), network(DELETE /api/contacts/{id} -> 200)

### VAL-CON-003: Contact add/remove respects roles, server-side

A viewer sees no Add or Remove controls. An assessor can Add but cannot Remove.
The restriction holds against direct API calls.
Tool: agent-browser, agent-api
Evidence: screenshot(viewer-readonly), network(DELETE /api/contacts/{id} as assessor -> 403), network(POST /api/contacts as viewer -> 403)

---

## Editing a pitch

### VAL-PITCH-001: Admin/assessor can edit an existing pitch

From a pitch's detail page, an admin or assessor opens an "Edit" affordance, the
form is pre-filled with the pitch's current values, they change a field (e.g.
title), save, and the detail page shows the updated value.
Tool: agent-browser
Evidence: screenshot(edit-form-prefilled), screenshot(detail-updated), network(PATCH /api/pitches/{id} -> 200)

### VAL-PITCH-002: Viewers cannot edit a pitch

A viewer sees no Edit control on the detail page, and navigating directly to a
pitch's edit URL does not render an editable form (they are sent away). A direct
edit API call by a viewer is rejected.
Tool: agent-browser, agent-api
Evidence: screenshot(viewer-detail-no-edit), screenshot(redirect-from-edit-url), network(PATCH /api/pitches/{id} as viewer -> 403)

### VAL-PITCH-003: Editing a pitch never changes its pipeline stage

The edit form offers no way to change the pipeline stage. After editing other
fields, the pitch's stage is unchanged and no new entry is added to its stage
history / activity timeline. Stage only changes via the board (see VAL-STAGE-*).
Tool: agent-browser
Evidence: screenshot(timeline-unchanged), network(PATCH /api/pitches/{id} with a stage field -> 200 and stage unchanged on subsequent GET)

### VAL-PITCH-004: "Confidential" is a visual marker only

A pitch marked confidential shows a "Confidential" badge, but the flag does not
restrict visibility: every authenticated role, including a viewer, can still open
and read the pitch. (Decision: marker only — to be revisited with the client.)
Tool: agent-browser
Evidence: screenshot(confidential-badge), screenshot(viewer-can-open-confidential-pitch)

---

## Editing pitch stage on the Kanban board

### VAL-STAGE-001: Right-click changes a pitch's stage and it persists

On the Kanban board, an admin or assessor right-clicks a pitch card, chooses a
different stage from the menu, and the card moves to that stage's column. After a
page reload the card is still in the new column.
Tool: agent-browser
Evidence: screenshot(menu-open), screenshot(card-moved), screenshot(after-reload), network(POST /api/pitches/{id}/stage -> 200)

### VAL-STAGE-002: A stage change is recorded with who and when

After a stage change, the pitch's activity timeline shows the transition (from →
to) attributed to the acting user.
Tool: agent-browser
Evidence: screenshot(timeline-entry)

### VAL-STAGE-003: A failed stage change reverts the card

If the stage update fails (server error), the card returns to its original column
rather than staying in the new one.
Tool: agent-browser
Evidence: screenshot(card-reverted), network(POST /api/pitches/{id}/stage -> 5xx)

### VAL-STAGE-004: Viewers cannot change stage

A viewer right-clicking a card gets no stage menu, and a direct stage-change API
call by a viewer is rejected.
Tool: agent-browser, agent-api
Evidence: screenshot(viewer-no-menu), network(POST /api/pitches/{id}/stage as viewer -> 403)

### VAL-STAGE-005: The stage menu is usable

The menu marks the card's current stage as non-selectable, and closes when the
user clicks outside it or presses Escape.
Tool: agent-browser
Evidence: screenshot(current-stage-marked), screenshot(menu-closed-on-escape)

---

## User management access control

### VAL-USERS-001: Admins can manage users

An admin sees a "Users" entry in navigation and opens User Management to view the
staff list including emails, roles, and active status.
Tool: agent-browser
Evidence: screenshot(user-list), network(GET /api/users -> 200)

### VAL-USERS-002: Non-admins cannot reach user management in the UI

An assessor and a viewer see no "Users" navigation entry, and navigating directly
to the user-management URL sends them away without rendering any user-management
content.
Tool: agent-browser
Evidence: screenshot(no-users-link), screenshot(redirected-from-admin-users)

### VAL-USERS-003: The user-management lockdown is enforced server-side

A non-admin requesting the staff-management listing directly via the API (bypassing
the hidden UI) is forbidden — the full list of users with emails/roles/status is
never returned to a non-admin.
Tool: agent-api
Evidence: network(GET /api/users as assessor -> 403), network(GET /api/users as viewer -> 403)

### VAL-USERS-004: Name display still works for non-admins

An assessor or viewer can still see colleagues' display names where the app shows
them (lead pickers, meeting attendee lists, assessor names), but cannot obtain the
sensitive staff directory (emails, roles, account status) through those surfaces.
Tool: agent-browser, agent-api
Evidence: screenshot(assessor-lead-picker-shows-names), network(name-lookup response contains display names but no email/role/is_active)

---

## Cross-cutting

### VAL-CROSS-001: Privileged actions are enforced on the server, not just hidden in the UI

For every restricted action (delete organisation/contact, edit pitch, change stage,
list users), performing it via a direct API call while authenticated as a role that
should not be allowed is rejected with 403 — the hidden/disabled UI is never the
only barrier.
Tool: agent-api
Evidence: network(DELETE /api/organisations/{id} as assessor -> 403), network(PATCH /api/pitches/{id} as viewer -> 403), network(POST /api/pitches/{id}/stage as viewer -> 403), network(GET /api/users as viewer -> 403)
