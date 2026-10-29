# Implementation Plan: Hide Long-Closed Pitches from the Pipeline

**Branch**: `004-hide-closed-pitches` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-hide-closed-pitches/spec.md`

## Summary

The pitch API gains a read-only, derived `stage_entered_at` on `PitchOut`: the latest
`pitch_stage_history.changed_at` whose `to_stage` is the pitch's current stage, or
`created_at` if there is none. It is computed in the pitch routes the same way
`decline_reason` already is, with one grouped query per request rather than one per pitch.
The Pipeline page hides pitches for which a pure function, `isLongClosed(pitch, now,
thresholdDays)`, is true, passing the constant 90. A "Show old pitches" / "Hide old pitches" toggle, kept in the URL as
`?closed=show`, brings them back. No schema change, and no other page changes.

Decisions are in [research.md](research.md), the wire change in
[contracts/pitch-out.md](contracts/pitch-out.md).

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript / React 18 (frontend)

**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic v2; React Router 6
(`useSearchParams`). No new dependencies.

**Storage**: PostgreSQL 16. Read-only use of `pitch_stage_history`. No migration.

**Testing**: pytest against real Postgres for `stage_entered_at`; Vitest unit tests for
`isLongClosed` (pure, no mocks); a `PipelinePage` component test for the toggle and counts.

**Target Platform**: DigitalOcean App Platform.

**Project Type**: Web application.

**Performance Goals**: The pitch list stays one request. The extra grouped query scans
`pitch_stage_history`, which holds a handful of rows per pitch (hundreds in total), so no
index is added. If the table grows into the tens of thousands, an index on `pitch_id` is the
first step.

**Constraints**: Only the Pipeline page changes behaviour (FR-003). The threshold is an
argument, not a module constant read inside the rule (FR-007).

**Scale/Scope**: 2 backend files, about 4 frontend files, plus tests.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Activity rules**: A4, A5 and A7 apply (UI code on the Pipeline page). A6 doesn't apply (no
dependency, no route change). A16–A22 don't apply.

| Rule                          | Applies | How the plan complies                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 Optimize for deletion      | Yes     | No new abstraction: one route helper (`_stage_entered_at`), shaped like the existing `latest_assessment_by_pitch` lookup, and one pure function. The toggle is inline in `PipelinePage`.                                                                                                                                                                                                                                                                                                    |
| C2 Explicit dependencies      | Yes     | The route helper takes the session and pitches as arguments. `isLongClosed` takes `now` and `thresholdDays` as arguments, so the per-user follow-up passes its own value and tests pass a fixed clock.                                                                                                                                                                                                                                                                                      |
| C3 Test the transformation    | Yes     | `stage_entered_at` is tested through the API on real Postgres, with history rows written at known times. `isLongClosed` is a pure-function unit test. The `PipelinePage` test mocks `services/api` (own code, grandfathered) and stubs `components/Layout` as every page test does (docs/best-practices/frontend-react.md); both are recorded in Complexity Tracking. It uses the real `AuthProvider` and `MemoryRouter`.                                                                   |
| C4 Discoverable commands      | Yes     | No new repeatable action.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| C5 Recovery over prevention   | Yes     | Additive and read-only: a new response field and a client-side filter. Reverted by redeploying the previous commit (under 5 minutes). Nothing is deleted, so no gate is needed.                                                                                                                                                                                                                                                                                                             |
| C6 Value realized at the user | Yes     | **Observed by**: (1) the access log (`event=http_request`) for `GET /api/pitches` keeps its status and duration after deploy, since the added query must not slow the list; (2) on production, `/pipeline` shows a "Show old pitches" control exactly when some pitch in Declined or Completed has a `stage_entered_at` more than 90 days old, read from `GET /api/pitches`; (3) showing them puts them back, and a hidden pitch is still found by search. Done when checked in production. |
| A4 Accessibility              | Yes     | The toggle is a native `button` whose text label says what pressing it will do ("Show old pitches" / "Hide old pitches"). Because the label carries the state, it has no `aria-pressed`, which would have a screen reader announce "Hide old pitches, pressed". No custom widget.                                                                                                                                                                                                           |
| A5 Render what you can prove  | Yes     | The Pipeline page's fetch is unchanged. The new state, "everything here is hidden", gets copy: with every pitch hidden, the page still shows the toggle rather than an empty board with no explanation. The grandfathered gaps (no request timeout, no retry on the page's fetch) are this view's, and a view a plan touches gains both: the page gets a timeout-backed error state with a retry button.                                                                                    |
| A7 State at the edge          | Yes     | Whether hidden pitches are shown is URL state (`?closed=show`), since a user would bookmark or share it. `stage_entered_at` is server state read from the response. The page's other filters are already component state; moving them is out of scope (spec Assumptions) and they aren't touched.                                                                                                                                                                                           |

**Result**: PASS, with the exception below.

**Post-design re-check (after Phase 1)**: PASS, unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/004-hide-closed-pitches/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/pitch-out.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── app/schemas/pitch.py              # PitchOut.stage_entered_at (read-only, derived)
├── app/api/routes/pitches.py         # _stage_entered_at lookup; fill it in every PitchOut response
└── tests/test_pitches.py             # stage_entered_at cases
frontend/src/
├── types.ts                          # Pitch.stage_entered_at
├── components/pipeline/closedPitches.ts          # isLongClosed + CLOSED_PITCH_HIDE_AFTER_DAYS
├── components/pipeline/__tests__/closedPitches.test.ts
├── pages/PipelinePage.tsx            # hide, count, toggle in URL, error state with retry
└── pages/__tests__/PipelinePage.test.tsx
```

**Structure Decision**: The existing layout. One branch, `004-hide-closed-pitches`, stacked
last in the sequence the maintainer asked for. It carries backend and frontend together
because the field and its only consumer ship as one change.

## Complexity Tracking

| Violation                                                                                                        | Why Needed                                                                                                                | Simpler Alternative Rejected Because                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C3: the new `PipelinePage` test mocks `src/services/api` (own code, grandfathered) and stubs `components/Layout` | The page fetches on mount, and the behaviour under test (what's hidden, the count, the toggle, the URL) is in the render. | No fake HTTP server exists for jsdom. The hiding rule itself is tested as a pure function with no mocks, so the mocked test only covers the wiring. The `Layout` stub follows the documented page-test convention, since navigation is tested at the shell seam. |
| Backend and frontend in one PR, not AGENTS.md's split                                                            | The field exists only for this page; shipping it alone would be an unused API change.                                     | Maintainer's choice of one branch per issue.                                                                                                                                                                                                                     |
