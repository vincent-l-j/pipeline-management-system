# Validation Contract

This document is the **acceptance contract** for four features. It defines the
observable behaviour each feature must exhibit (backend API + frontend
components) and enumerates the **unit tests** that must exist and pass to
consider the feature done. It is a specification only — no implementation is
included here.

Conventions:

- **Backend tests** live in `backend/tests/` and use the FastAPI `TestClient`
  fixtures already defined in `tests/conftest.py`: `client` (unauthenticated),
  `admin_client`, `assessor_client`, `viewer_client`. They run against in-memory
  SQLite.
- **Frontend tests** live in `__tests__/` folders next to the component, using
  Vitest + React Testing Library (`npm test`). Network calls are made through
  `src/services/api.js` (axios) and must be mocked.
- Each test has a stable ID (`BE-A1`, `FE-A1`, …) for traceability. A feature is
  "accepted" only when every test listed under it is present and green.
- Roles are `admin`, `assessor`, `viewer` (see `app/models/user.py`).

Decisions baked into this contract (confirmed with the product owner):

1. Deletion of organisations and contacts is a **hard delete** (row removed).
2. Deleting an **organisation** orphans its children by **nulling the FK**
   (`organisation_id` → `NULL`) on linked contacts and pitches; those rows
   survive.
3. Deleting a **contact** **hard-deletes its join rows** — `PitchContact`
   (pitch↔contact) and `MeetingAttendee` (meeting attendance) — so the contact
   disappears from those pitches/meetings cleanly. No new nullable columns.
4. The pitch **edit** UI is a dedicated `/pitches/:id/edit` route that reuses the
   create form pre-filled and submits `PATCH /api/pitches/{id}`.
5. RBAC is unchanged and the UI mirrors it: **Admin + Assessor** can add
   orgs/contacts and change pitch stage; **Admin only** can delete. Viewers see
   neither the add/remove buttons nor the right-click stage menu.

### Security baseline (applies to every feature)

These hold across all four features and the tests below assume them:

- **The frontend is never the security boundary.** Role-gated buttons, the
  `/admin/users` redirect, and hidden menus all key off `user.role` read from
  `localStorage`, which the client fully controls. They are UX only. Every
  authorization decision is enforced server-side via `require_role(...)`; the
  backend `403`/`401` tests are the real controls, the frontend tests only
  assert UX.
- **Least-privilege data exposure.** An endpoint must not return more than the
  caller needs. In particular the user list is split (see Feature D): a minimal
  directory for name-resolution vs. the full admin-only management list.
- **No client-trusted role.** `get_current_user` reloads the user from the DB
  and checks `is_active` on every request, so demotions/deactivations take
  effect immediately — role is never trusted from the JWT payload alone.
- **Mass-assignment is closed by construction.** All write schemas are explicit
  allowlists (Pydantic drops unknown fields); tests must not assume a field can
  be set unless it appears in the relevant `*Create`/`*Update` schema.

---

## Current-state gaps this contract closes

These are the deltas between today's code and the contract, so implementers know
what must change (the tests below assume the target behaviour):

| # | Area | Today | Required |
|---|------|-------|----------|
| 1 | `DELETE /api/organisations/{id}` | Hard-deletes the org; does **not** null child FKs (children with `organisation_id` set are left dangling / can violate FK in Postgres) | Null `organisation_id` on all child contacts **and** pitches, then delete the org |
| 2 | `DELETE /api/contacts/{id}` | Hard-deletes the contact; leaves `PitchContact` / `MeetingAttendee` rows pointing at a missing contact | Delete the contact's `PitchContact` and `MeetingAttendee` rows in the same transaction |
| 3 | `GET /api/users` (and `GET /api/users/{id}`) | Guarded by `get_current_user` only → **any authenticated user can list every user's email, role, and active status** (info disclosure) | Restrict the full list/detail (`UserOut`) to `require_role(ADMIN)` |
| 4 | User name-resolution | Six non-admin surfaces (`PipelinePage`, `PitchCreatePage`, `PitchDetailPage`, `AssessmentsPage`, `AssessmentDetailPage`, `MeetingAttendees`) call `GET /api/users` for `display_name` | Add `GET /api/users/directory` (id + display_name only, admin+assessor+viewer) and repoint those callers, so locking down #3 doesn't break them |
| 5 | `/admin/users` route (frontend) | Wrapped in `ProtectedRoute` (auth only); Sidebar hides the link but the route still renders for non-admins | Add an admin-only route guard that redirects non-admins away (UX defence-in-depth on top of #3) |
| 6 | Organisations / Contacts pages | Read-only tables, no add/remove controls | Add "Add" + per-row "Remove" buttons wired to the API, role-gated |
| 7 | Pitch detail page | No "Edit" affordance; no edit route | "Edit" button → `/pitches/:id/edit` reusing the create form |
| 8 | Kanban `PitchCard` | Stage change via drag only | Right-click opens a stage-picker context menu that calls the stage endpoint |
| 9 | `is_confidential` on pitches | Cosmetic flag; confidential pitches are returned to **all** authenticated users (incl. viewer) by `GET /pitches` and `/pitches/{id}` | **Decision required** (see Feature B.4): either enforce visibility on the flag, or document it as a non-security marker |

---

## Feature A — Add / remove Organisations & Contacts (with orphaning)

### A.1 Backend API contract

Endpoints already exist; behaviour is tightened.

**Create** — `POST /api/organisations`, `POST /api/contacts`
- Roles: `admin`, `assessor` → `200` with created body (includes `id`).
- `viewer` → `403`. Unauthenticated → `401`.
- Minimal valid body is `{"name": "..."}`; `name` is required (`422` if missing).

**Delete organisation** — `DELETE /api/organisations/{id}` (role: `admin` only)
- `200 {"detail": "Organisation deleted"}` on success; org row no longer
  retrievable (`GET` → `404`).
- **Orphaning:** every contact and pitch that had `organisation_id == {id}`
  still exists afterwards, with `organisation_id == null`. No child rows are
  deleted.
- Unknown id → `404`. `assessor`/`viewer` → `403`.

**Delete contact** — `DELETE /api/contacts/{id}` (role: `admin` only)
- `200 {"detail": "Contact deleted"}`; contact `GET` → `404`.
- **Cascade of links:** all `PitchContact` rows and all `MeetingAttendee` rows
  referencing the contact are removed. The parent pitches and meetings
  themselves are untouched (still retrievable).
- Unknown id → `404`. `assessor`/`viewer` → `403`.

### A.2 Frontend component contract

`OrganisationsPage` / `ContactsPage`:
- Render an **"Add Organisation" / "Add Contact"** button only when
  `user.role` is `admin` or `assessor`.
- The button opens a create form (modal or inline); submitting calls
  `api.post('/organisations'|'/contacts', body)` and, on success, the new row
  appears in the table without a full reload.
- Each row shows a **"Remove"** control only when `user.role === 'admin'`.
- "Remove" requires a confirmation step; on confirm it calls
  `api.delete('/organisations/{id}'|'/contacts/{id}')` and the row disappears
  from the table on success.
- `viewer` sees neither Add nor Remove controls (read-only table only).
- API error (e.g. 4xx) surfaces a visible error message and the table is left
  unchanged.

### A.3 Unit tests

Backend (`tests/test_organisations.py`, `tests/test_contacts.py`):

- **BE-A1** `admin` creates an organisation → `200`, body has `id` and `name`.
- **BE-A2** `assessor` creates an organisation → `200`.
- **BE-A3** `viewer` create org → `403`; unauthenticated create → `401`.
- **BE-A4** create org missing `name` → `422`.
- **BE-A5** `admin` deletes an org → `200`; subsequent `GET` → `404`.
- **BE-A6** *Orphan contacts:* create org, create contact with that
  `organisation_id`, delete org → contact still exists and its
  `organisation_id` is `null`.
- **BE-A7** *Orphan pitches:* create org, create pitch with that
  `organisation_id`, delete org → pitch still exists and its `organisation_id`
  is `null`.
- **BE-A8** `assessor` delete org → `403`; `viewer` delete org → `403`.
- **BE-A9** delete unknown org id → `404`.
- **BE-A10** `admin`/`assessor` create contact → `200`; `viewer` → `403`.
- **BE-A11** *Cascade pitch links:* link a contact to a pitch (`PitchContact`),
  delete the contact → the pitch still exists and the `PitchContact` link is
  gone (pitch's contact links no longer include it).
- **BE-A12** *Cascade meeting attendance:* add the contact as a
  `MeetingAttendee`, delete the contact → the meeting still exists and the
  attendee row is gone.
- **BE-A13** `admin` deletes contact → `200`, `GET` → `404`; `assessor`/`viewer`
  delete → `403`.
- **BE-A14** delete unknown contact id → `404`.

Frontend (`pages/__tests__/OrganisationsPage.test.jsx`,
`pages/__tests__/ContactsPage.test.jsx`):

- **FE-A1** Renders rows returned by a mocked `api.get`.
- **FE-A2** Admin sees the "Add" button; viewer does not.
- **FE-A3** Admin sees per-row "Remove"; assessor and viewer do not.
- **FE-A4** Clicking "Add", filling the form, and submitting calls
  `api.post` with the entered values and renders the new row on resolve.
- **FE-A5** Clicking "Remove" → confirm calls `api.delete` with the row id and
  removes the row on resolve.
- **FE-A6** "Remove" without confirming does **not** call `api.delete`.
- **FE-A7** A rejected `api.delete` leaves the row present and shows an error.

---

## Feature B — Edit an existing pitch

### B.1 Backend API contract

`PATCH /api/pitches/{id}` (exists; role: `admin`, `assessor`):
- Partial update: only supplied fields change (`exclude_unset`); omitted fields
  are preserved.
- `200` with the full updated pitch on success.
- `viewer` → `403`; unauthenticated → `401`; unknown id → `404`.
- **`current_stage` cannot be changed via this endpoint.** The `PitchUpdate`
  schema deliberately omits `current_stage`, so a `PATCH` carrying it has no
  effect (the field is dropped). All stage changes — and therefore all
  `PitchStageHistory` audit rows — flow exclusively through the stage endpoint
  (Feature C). This is a security/audit invariant, not just a convention:
  there must be **no** path that mutates stage without writing history.

### B.2 Frontend component contract

- `PitchDetailPage` shows an **"Edit"** button when `user.role` is `admin` or
  `assessor` (same `canEdit` gate already used for Log Meeting / New
  Assessment); hidden for `viewer`.
- "Edit" navigates to `/pitches/:id/edit`.
- The edit route renders the pitch form (shared with create) **pre-populated**
  from `GET /api/pitches/{id}`.
- Submitting calls `PATCH /api/pitches/{id}` with the changed fields and, on
  success, navigates to `/pitches/:id` (detail).
- Cancel returns to the detail page without calling the API.
- A `viewer` who navigates directly to `/pitches/:id/edit` is redirected away
  (no edit form rendered) — **UX only; the real guard is the `403` on `PATCH`**.

### B.3 Confidentiality decision (`is_confidential`)

The edit form can toggle `is_confidential`, which forces a decision because the
flag currently gates **nothing**: `GET /pitches` and `GET /pitches/{id}` return
confidential pitches to every authenticated user, including viewers.

- **Option 1 — marker only (default if unanswered):** `is_confidential` is a
  purely visual label with no access-control meaning. Documented as such here so
  it is not mistaken for a security control. No backend change; tests assert the
  flag round-trips but do **not** assert any visibility restriction.
- **Option 2 — enforce visibility:** confidential pitches are filtered/forbidden
  for roles that should not see them (e.g. `viewer`, or non-lead users). This
  needs a defined rule (who may see a confidential pitch?) and adds tests:
  list excludes confidential pitches for unauthorised roles, and
  `GET /pitches/{id}` on a confidential pitch → `403`/`404` for them.

> **Owner action:** pick Option 1 or 2. Until chosen, implementers must treat the
> flag as non-security (Option 1) and must not rely on it to hide data.

### B.4 Unit tests

Backend (`tests/test_pitches.py`):

- **BE-B1** `admin` patches `title` only → `200`, `title` changed, other fields
  (e.g. `short_description`, `source`) unchanged.
- **BE-B2** `assessor` patch → `200`.
- **BE-B3** `viewer` patch → `403`; unauthenticated → `401`.
- **BE-B4** patch unknown id → `404`.
- **BE-B5** patch with empty body `{}` → `200`, pitch unchanged.
- **BE-B6** *Stage cannot be changed via PATCH:* patch a body containing
  `current_stage` (a different stage) → `200`, but `current_stage` is unchanged
  and **no** new `PitchStageHistory` row was created.
- **BE-B7** *(Option 2 only)* `viewer` `GET /pitches/{id}` on a confidential
  pitch → `403`/`404`, and the confidential pitch is absent from the `viewer`
  list. *(Omit if Option 1 is chosen.)*

Frontend (`pages/__tests__/PitchDetailPage.test.jsx`,
`pages/__tests__/PitchEditPage.test.jsx`):

- **FE-B1** Detail page shows "Edit" for admin/assessor, hides it for viewer.
- **FE-B2** Clicking "Edit" navigates to `/pitches/:id/edit`.
- **FE-B3** Edit page fetches the pitch and renders the form pre-filled with its
  values.
- **FE-B4** Changing a field and submitting calls `api.patch('/pitches/{id}',
  …)` with the changed field, then navigates to the detail route.
- **FE-B5** Cancel navigates back to detail and makes no `api.patch` call.
- **FE-B6** Viewer hitting the edit route is redirected (form not rendered).

---

## Feature C — Edit pitch stage via right-click on the Kanban board

### C.1 Backend API contract

`POST /api/pitches/{id}/stage` (exists; role: `admin`, `assessor`):
- Body `{ "new_stage": <PipelineStage>, "note": <optional str> }`.
- `200` with the updated pitch; `current_stage == new_stage`.
- Appends a `PitchStageHistory` row capturing `from_stage`, `to_stage`,
  `changed_by_id`, and `note`.
- Invalid `new_stage` (not a `PipelineStage` value) → `422`.
- `viewer` → `403`; unauthenticated → `401`; unknown id → `404`.

This is the same endpoint used by drag-and-drop; the right-click menu is an
alternative trigger, so no new endpoint is needed.

### C.2 Frontend component contract

`PitchCard` (within `KanbanColumn` / `KanbanBoard`):
- Right-click (`onContextMenu`) on a card opens a **stage context menu** listing
  all `PIPELINE_STAGES` (from `PipelineConfig`), with the card's current stage
  indicated and not actionable.
- The menu is only available to `admin`/`assessor`; for `viewer` the context
  menu does not open (default browser menu may show, or is suppressed — but no
  app menu).
- Selecting a different stage calls the board's stage-change handler, which
  optimistically moves the card and calls
  `api.post('/pitches/{id}/stage', { new_stage, note })` — the same path the
  drag handler uses.
- On API failure the optimistic move is reverted (card returns to its original
  column), matching existing drag behaviour.
- The menu closes on selection, on outside click, and on `Escape`.

### C.3 Unit tests

Backend (`tests/test_pitches.py` — extends existing stage tests):

- **BE-C1** `admin` posts a stage change → `200`, `current_stage` updated.
- **BE-C2** stage change appends a history row with correct `from_stage` /
  `to_stage` and the acting user as `changed_by_id`.
- **BE-C3** `assessor` → `200`; `viewer` → `403`; unauthenticated → `401`.
- **BE-C4** invalid `new_stage` → `422`.
- **BE-C5** unknown pitch id → `404`.

Frontend (`components/pipeline/__tests__/PitchCard.test.jsx`,
`KanbanBoard.test.jsx`):

- **FE-C1** Right-clicking a card opens the stage menu listing all stages
  (admin/assessor context).
- **FE-C2** The current stage is shown as active and is not selectable.
- **FE-C3** Selecting a new stage invokes the stage-change callback with the
  card id and chosen stage.
- **FE-C4** The board handler calls `api.post('/pitches/{id}/stage', …)` and
  moves the card to the new column on success.
- **FE-C5** On a rejected `api.post`, the card reverts to its original column.
- **FE-C6** Menu closes on outside click and on `Escape`.
- **FE-C7** For a `viewer`, right-click does not open the app stage menu.

---

## Feature D — Non-admins cannot access user management

**Why this isn't just "add `require_role(ADMIN)`":** `GET /api/users` is consumed
by six non-admin surfaces for `display_name` resolution (`PipelinePage`,
`PitchCreatePage`, `PitchDetailPage`, `AssessmentsPage`, `AssessmentDetailPage`,
`MeetingAttendees`). Simply locking it to admin would break every assessor and
viewer workflow that renders a person's name or a lead picker. The fix therefore
**splits the endpoint** into a privileged management list and an unprivileged
directory, applying least privilege to both authorization *and* the fields
returned.

### D.1 Backend API contract

`/api/users` routes (`app/api/routes/users.py`):

**Management surface — admin only**
- `GET /api/users` (list) → **`admin` only**: `200` for admin; `403` for
  assessor and viewer; `401` unauthenticated. Returns full `UserOut`
  (`email`, `role`, `is_active`, …).
- `GET /api/users/{id}` → **`admin` only**: `403` for non-admin.
- `POST /api/users`, `PATCH /api/users/{id}` → `admin` only (already enforced):
  non-admin `403`.

**Directory surface — for name resolution (new)**
- `GET /api/users/directory` → any authenticated user (`admin`, `assessor`,
  `viewer`): `200` with a **minimal** shape — `{ id, display_name }` per user
  and **nothing else** (no `email`, `role`, `is_active`, `azure_oid`). `401`
  unauthenticated.
- A dedicated `UserDirectoryOut` schema enforces the minimal shape so fields
  cannot leak by accident.
- The six callers above are repointed from `GET /api/users` to
  `GET /api/users/directory`.

**Self**
- `GET /api/users/me` → any authenticated user; returns the caller's own
  profile. Explicitly not locked to admin.

> Route ordering: `/api/users/directory` and `/api/users/me` must be declared
> **before** `/api/users/{id}` so the literal paths aren't captured by the
> UUID path param.

### D.2 Frontend component contract

- The **Users** nav item in `Sidebar` renders only for `user.role === 'admin'`
  (already true — pin it with a test).
- The `/admin/users` route is guarded by an **admin-only** route wrapper: a
  non-admin who navigates there directly is **redirected** (e.g. to `/`) and
  `UsersPage` does not render. *(This is defence-in-depth/UX — the real control
  is the `403` on `GET /api/users`.)*
- `UsersPage`, when rendered (admin), lists users from `GET /api/users`.
- Name-resolution surfaces use `GET /api/users/directory` and therefore keep
  working for assessor and viewer.

### D.3 Unit tests

Backend (`tests/test_users.py`):

- **BE-D1** `admin` `GET /api/users` → `200`, list.
- **BE-D2** `assessor` `GET /api/users` → `403`.
- **BE-D3** `viewer` `GET /api/users` → `403`.
- **BE-D4** unauthenticated `GET /api/users` → `401`.
- **BE-D5** `assessor`/`viewer` `GET /api/users/{id}` → `403`.
- **BE-D6** `GET /api/users/me` → `200` for admin, assessor, and viewer
  (each returns its own email/role).
- **BE-D7** `assessor`/`viewer` `POST /api/users` → `403` (regression guard).
- **BE-D8** `assessor`/`viewer` `PATCH /api/users/{id}` → `403` (regression
  guard).
- **BE-D9** `GET /api/users/directory` → `200` for admin, assessor, **and**
  viewer.
- **BE-D10** *Minimal shape:* a `directory` entry contains exactly `id` and
  `display_name` and **no** `email`, `role`, `is_active`, or `azure_oid`
  (asserts the info-disclosure fix).
- **BE-D11** `GET /api/users/directory` unauthenticated → `401`.

Frontend (`components/__tests__/Sidebar.test.jsx`, plus a route-guard test —
`__tests__/AdminRoute.test.jsx` or within `App.test.jsx`):

- **FE-D1** Sidebar renders the "Users" link for admin.
- **FE-D2** Sidebar omits the "Users" link for assessor and viewer.
- **FE-D3** Rendering `/admin/users` as a viewer redirects away and does not
  render `UsersPage`.
- **FE-D4** Rendering `/admin/users` as an assessor redirects away.
- **FE-D5** Rendering `/admin/users` as an admin renders `UsersPage`.
- **FE-D6** A name-resolution surface (e.g. `PitchCreatePage` lead picker) calls
  `GET /api/users/directory` (not `/api/users`) and renders for an assessor.

---

## Traceability summary

| Feature | Backend tests | Frontend tests |
|---------|---------------|----------------|
| A — Add/remove orgs & contacts + orphaning | BE-A1 … BE-A14 | FE-A1 … FE-A7 |
| B — Edit existing pitch | BE-B1 … BE-B7 | FE-B1 … FE-B6 |
| C — Right-click stage edit | BE-C1 … BE-C5 | FE-C1 … FE-C7 |
| D — Lock down user management | BE-D1 … BE-D11 | FE-D1 … FE-D6 |

## Security test checklist

The cross-cutting security guarantees, mapped to the tests that pin them:

- **Server-side authz is the boundary** — BE-A3/A8/A13, BE-B3, BE-C3, BE-D2/D3/D5/D7/D8.
- **Least-privilege data exposure** — BE-D10 (directory leaks no email/role/active).
- **No regression from the lockdown** — BE-D9, FE-D6 (directory keeps non-admins working).
- **Audit integrity** — BE-B6 (stage never changes without a history row), BE-C2.
- **Orphan/cascade leaves no dangling refs** — BE-A6, BE-A7, BE-A11, BE-A12.
- **Confidentiality** — BE-B7 *(only if Option 2 chosen)*; otherwise documented
  as a non-security marker (B.3).

All listed tests must be present and green, and the seven current-state gaps
must be closed, for these features to be accepted.
