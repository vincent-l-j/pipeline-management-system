# Implementation Plan: Remove the Received Pipeline Stage

**Branch**: `002-remove-received-stage` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-remove-received-stage/spec.md`

## Summary

Received is removed in two releases, each its own PR and deploy:

- **Retire** (User Stories 1 and 2, branch `002-remove-received-stage`): new pitches default
  to Initial Screen. The request schemas refuse Received as a target with a 422 that names it
  retired, through one `RETIRED_STAGES` set beside `PipelineStage`. No schema change. The
  frontend marks Received `retired` in `PIPELINE_STAGES`, so the board shows its column only
  while it holds pitches and won't accept drops into it, and the stage menu, filters and
  dashboard leave it out (the dashboard shows it only while it has pitches).
- **Drop** (User Story 3, branch `002-remove-received-stage-drop`, merged only after the
  retire release has been observed in production): one Alembic migration remaps Received to
  Initial Screen in `pitches` and `pitch_stage_history`, deletes the history rows that became
  no-op moves, and recreates the `pipelinestage` type without `RECEIVED`. The code then drops
  the enum member and the retired-stage handling for it.

Design decisions are in [research.md](research.md), the stage lifecycle in
[data-model.md](data-model.md), and the wire behaviour in
[contracts/stage-api.md](contracts/stage-api.md).

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript / React 18 (frontend)

**Primary Dependencies**: FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic with
`alembic-postgresql-enum` (backend); Vite, Tailwind, `@hello-pangea/dnd` (frontend). No new
dependencies.

**Storage**: PostgreSQL 16. The `pipelinestage` enum type is used by `pitches.current_stage`,
`pitch_stage_history.from_stage` and `pitch_stage_history.to_stage`.

**Testing**: pytest against the real Postgres test database (`backend/tests/`); migration
suite in `backend/tests/migrations/` (Level 2 data-safety round-trip); Vitest + RTL
(`frontend/src/**/__tests__`).

**Target Platform**: DigitalOcean App Platform; the migration runs as the PRE_DEPLOY job.

**Project Type**: Web application (FastAPI backend + React SPA).

**Performance Goals**: N/A. No query shape changes; the migration touches only Received rows
and a small table.

**Constraints**: The retire release must not change the schema. The drop release must not
merge until the retire release has been observed in production (C6 signal below).

**Scale/Scope**: About 4 backend files and 8 frontend files in the retire release; one
migration plus enum/config deletions in the drop release.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Activity rules**: A4 and A7 apply (UI code). A5 applies to the views touched. A6 doesn't
apply: no dependency is added and routes aren't restructured. A16–A22 don't apply (no LLM, no
telemetry or alerting changes).

| Rule                          | Applies | How the plan complies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 Optimize for deletion      | Yes     | No new abstraction. Retirement is a set constant (backend) and a `retired` flag on an existing config entry (frontend), both deleted by the drop release. The duplicated stage tables in `PitchesPage`, `DashboardPage` and `ReportsPage` are left alone, apart from the lines this feature must change, because consolidating them isn't this feature's concern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| C2 Explicit dependencies      | Yes     | The refusal is a Pydantic field validator on the request schemas, using a module-level constant. No hidden state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| C3 Test the transformation    | Yes     | Backend behaviour is tested through the API against real Postgres. The migration is tested by a Level 2 data-safety test pinned to its revision, which asserts the lossy downgrade too. New frontend cases for the board, column and card stage menu go in new files that render the real `PipelineConfig`, the real `AuthProvider` (seeded through `localStorage`) and a `MemoryRouter`, with only the third-party dnd stub (`src/test/mocks/dnd.ts`, which gains an `isDropDisabled` pass-through) standing in. They don't extend the own-code mocks of `PipelineConfig` and `AuthContext` in the existing `PitchCard`/`KanbanColumn`/`KanbanBoard` tests. The `PipelineFilters` test's `PIPELINE_STAGES` override is removed (paid down) so it reads the real stages. The one remaining own-code mock, `services/api` in the page tests, is recorded in Complexity Tracking. |
| C4 Discoverable commands      | Yes     | No new repeatable action. Existing `services.yaml` commands cover every test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| C5 Recovery over prevention   | Yes     | **Retire release**: no schema change; reverted by redeploying the previous commit (under 5 minutes). **Drop release**: the contract step of expand-then-contract. Retiring the stage in the app is the "tolerate" step, and the enum value already exists, so there is no expand step. The migration deletes data (no-op history rows, and which pitches were in Received), so its `downgrade()` only restores the enum value and its docstring names the restore path: restore the pre-deploy backup on the production (backed-up) DB tier, then redeploy the previous commit. That is longer than 5 minutes, recorded in Complexity Tracking. The gate on the deletion is the release itself: the drop PR merges only after the retire release's signal is checked. No runtime flag, because the migration runs once.                                                         |
| C6 Value realized at the user | Yes     | **Retire release, observed by**: (1) the decisive check, a read-only count of `pitch_stage_history` rows with `to_stage = 'RECEIVED'` and `changed_at` after the deploy time, which must stay 0; (2) advisory: access log records (`event=http_request`) with `status_code=422` on `POST /api/pitches` and `POST /api/pitches/{id}/stage` (not specific to Received, since other validation errors also 422, but a rise after deploy is worth reading); (3) the board loading with the retired column present or absent as the data says. **Drop release, observed by**: the PRE_DEPLOY migrate job succeeding, the counts of `RECEIVED` in both tables being 0 (the type no longer has the value), and `/api/health/ready` plus the board and a pitch detail page loading. Done when each is checked in production.                                                            |
| A4 Accessibility              | Yes     | No new widget. The retired column is the existing column component with a different label. The stage menu and filters drop an option.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| A5 Render what you can prove  | Partly  | The views touched keep their existing four states. This plan doesn't touch their fetch logic, so the grandfathered gaps (no timeout, no retry) are left as they are, because no fetching code changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| A7 State at the edge          | Yes     | No new state. The retired column is derived from the fetched pitches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Result**: PASS, with the drop migration's lossy downgrade recorded in Complexity Tracking.

**Post-design re-check (after Phase 1)**: PASS, unchanged. The design adds no abstraction,
command or dependency.

## Project Structure

### Documentation (this feature)

```text
specs/002-remove-received-stage/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/stage-api.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── app/models/pitch.py                  # default stage; RETIRED_STAGES (retire) · drop RECEIVED (drop)
├── app/schemas/pitch.py                 # default + refusal validator
├── alembic/versions/<rev>_drop_received_stage.py   # (drop)
└── tests/
    ├── test_pitches.py                  # create default, refusal, existing Received pitch still movable
    └── migrations/test_migrations.py    # Level 2 test pinned to the drop revision
frontend/src/
├── components/pipeline/PipelineConfig.ts      # `retired` flag, ACTIVE_STAGES, isRetiredStage
├── components/pipeline/KanbanBoard.tsx        # retired column only while non-empty
├── components/pipeline/KanbanColumn.tsx       # "(retired)" label, drop disabled
├── components/pipeline/PitchCard.tsx          # stage menu offers active stages only
├── components/pipeline/PipelineFilters.tsx    # stage filter offers active stages only
├── pages/DashboardPage.tsx                    # retired row only while non-empty
├── pages/ReportsPage.tsx                      # stage filter skips retired stages
└── test/mocks/dnd.ts                          # pass isDropDisabled through for assertions
README.md                                      # board stage count and first stage
```

**Structure Decision**: The existing backend/frontend layout. The two releases are separate
branches stacked in order, and the drop branch carries both the migration and the code that
stops tolerating Received. One PR per issue stage was the maintainer's choice, rather than
AGENTS.md's backend/frontend split, because each release has to change both sides together.

## Complexity Tracking

| Violation                                                                                              | Why Needed                                                                                                                                                                                                 | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C5: the drop migration's downgrade is lossy, and recovering takes a backup restore (over 5 minutes)    | The spec (FR-010, the maintainer's choice) deletes history rows, and remapping Received to Initial Screen erases which rows were Received. Neither can be recomputed from what remains.                    | Keeping the original stage in a new column so the downgrade could restore it would add a schema expand step for a value the product has decided to forget. Remapping without deleting was offered and declined.                                                                                                                                                                                                                              |
| Retire and drop each ship backend and frontend in one PR, not AGENTS.md's backend/frontend split       | The refusal (backend) and the stage pickers (frontend) have to change together. A frontend-only release would leave the API accepting Received, and a backend-only one would show users a menu that fails. | Splitting would need a third release order just to keep the two sides consistent. The maintainer asked for one branch per issue stage.                                                                                                                                                                                                                                                                                                       |
| C3: new `DashboardPage` and `ReportsPage` test cases mock `src/services/api` (own code, grandfathered) | Both pages fetch on mount and render straight from the response, and the behaviour under test (a retired stage shown only while non-empty, never offered as a filter) is in the render.                    | The project has no fake HTTP server to stand in for the API in jsdom. Adding one is infrastructure outside this feature. The cases go in the existing `DashboardPage.test.tsx` and a new `ReportsPage.test.tsx` that follows the same pattern. Both also stub `components/Layout`, as every page test does (docs/best-practices/frontend-react.md), because navigation is tested at the shell seam and the page tests never need the drawer. |
| C5: the data deletion in the drop release is gated by release order, not a feature flag                | C5 gates data deletion. The deletion here is a one-shot PRE_DEPLOY migration, and a runtime flag can't gate a migration that has already run.                                                              | The gate is the release itself: the drop PR merges only after the retire release's C6 signal is checked (tasks.md's gate task), and production has a pre-deploy backup to restore. Introducing a flag mechanism for a one-shot migration would add machinery that guards nothing.                                                                                                                                                            |
