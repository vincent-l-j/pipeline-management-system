# Implementation Plan: Merge Deep Assessment into Due Diligence

**Branch**: `003-merge-deep-assessment` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-merge-deep-assessment/spec.md`

## Summary

The same two-release shape as [#160's plan](../002-remove-received-stage/plan.md), applied to
Deep Assessment with Due Diligence as its successor:

- **Retire** (User Stories 1 and 2, branch `003-merge-deep-assessment`, stacked on #160's
  retire branch): add `DEEP_ASSESSMENT` to the backend's `RETIRED_STAGES` and mark
  `deep_assessment` `retired` in the frontend's `PIPELINE_STAGES`. Everything #160 built for a
  retired stage (refusal, hidden from pickers and filters, a column only while non-empty, no
  drops into it, the dashboard row only while non-empty) then applies to it unchanged. The
  "advanced to assessment" figure keeps counting it. No schema change.
- **Drop** (User Story 3, branch `003-merge-deep-assessment-drop`, stacked on #160's drop
  branch, merged only after this feature's retire release has been observed): one migration
  remaps Deep Assessment to Due Diligence, deletes the no-op history rows that mentioned it,
  and recreates `pipelinestage` without `DEEP_ASSESSMENT`. With Received already gone, this
  empties `RETIRED_STAGES`, so the drop release also deletes the retirement mechanism itself.

Decisions are in [research.md](research.md). The data and wire changes are in
[data-model.md](data-model.md) and [contracts/stage-api.md](contracts/stage-api.md).

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript / React 18 (frontend)

**Primary Dependencies**: unchanged from #160. No new dependencies.

**Storage**: PostgreSQL 16, the `pipelinestage` enum type (three columns, as in #160).

**Testing**: pytest on real Postgres, the migration suite (Level 2 test pinned to the
revision), Vitest + RTL, and the browser suite for fixtures that name the stage.

**Target Platform**: DigitalOcean App Platform; the migration runs as the PRE_DEPLOY job.

**Project Type**: Web application.

**Performance Goals**: N/A.

**Constraints**: The retire release must not change the schema. The drop release must not
merge before #160's drop release, or before this feature's retire release has been observed.

**Scale/Scope**: Retire: two one-line marker changes plus tests. Drop: one migration, then
deleting the enum member, the retirement mechanism and the stage's entries in the frontend
tables.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Activity rules**: A4, A5 and A7 apply as in #160's plan; this feature adds no new UI
element, only a second member to the existing retired-stage behaviour. A6 and A16–A22 don't
apply.

| Rule                          | Applies | How the plan complies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1 Optimize for deletion      | Yes     | No new code path: Deep Assessment joins the existing retired-stage set and flag. The drop release deletes the mechanism once it has no members, so it doesn't outlive its use.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| C2 Explicit dependencies      | Yes     | No change from #160: a module-level constant read by a schema validator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| C3 Test the transformation    | Yes     | Backend behaviour through the API on real Postgres; the migration by a Level 2 test pinned to its revision that also asserts the lossy downgrade. The frontend cases extend #160's tests that run against the real `PipelineConfig`, `AuthProvider` and `MemoryRouter`. The only own-code mock is `services/api` in the dashboard and reports page tests, already recorded as an exception in #160's plan and used here on the same terms.                                                                                                                                                                                     |
| C4 Discoverable commands      | Yes     | No new repeatable action.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| C5 Recovery over prevention   | Yes     | **Retire**: no schema change; reverted by redeploying the previous commit (under 5 minutes). **Drop**: lossy, as in #160. The `downgrade()` restores the enum value only, and the docstring names the restore path: the pre-deploy production backup, then redeploy the previous commit. The deletion is gated by release order (see Complexity Tracking).                                                                                                                                                                                                                                                                     |
| C6 Value realized at the user | Yes     | **Retire, observed by**: (1) decisive: zero `pitch_stage_history` rows with `to_stage = 'DEEP_ASSESSMENT'` after the deploy time; (2) advisory: 422s on the two stage-writing routes in the access log (`event=http_request`); (3) the board loading with the retired column present or absent as the data says, and the dashboard's "advanced to assessment" unchanged across the deploy. **Drop, observed by**: the PRE_DEPLOY job succeeding, no `DEEP_ASSESSMENT` left in either table, "advanced to assessment" unchanged across the deploy (SC-005), and `/api/health/ready`, the board and a pitch detail page loading. |
| A4 / A5 / A7                  | Yes     | As in #160's plan: no new widget or state, and the touched views' fetch logic is unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Result**: PASS, with the exceptions below.

**Post-design re-check (after Phase 1)**: PASS, unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/003-merge-deep-assessment/
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
├── app/models/pitch.py                # RETIRED_STAGES gains DEEP_ASSESSMENT (retire) · member and mechanism removed (drop)
├── app/schemas/pitch.py               # retired-stage validator removed (drop)
├── app/api/routes/reports.py          # DEEP_ASSESSMENT leaves the "advanced" list (drop)
├── alembic/versions/<rev>_merge_deep_assessment_stage.py   # (drop)
└── tests/                             # test_pitches.py, test_reports.py, migrations/test_migrations.py
frontend/src/
├── components/pipeline/PipelineConfig.ts   # `retired` on deep_assessment (retire) · entry and mechanism removed (drop)
├── components/pipeline/*.tsx               # retired-stage handling removed (drop)
├── pages/{Dashboard,Pitches,Reports}Page.tsx   # stage entry and retired checks removed (drop)
└── **/__tests__/                           # fixtures and retired-stage tests
README.md                                   # board stage count
```

**Structure Decision**: The existing layout, with two branches stacked after #160's matching
ones: 160-retire → 161-retire → 160-drop → 161-drop.

## Complexity Tracking

| Violation                                                                                         | Why Needed                                                                                          | Simpler Alternative Rejected Because                                                                                          |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| C5: the drop migration's downgrade is lossy, and recovery takes a backup restore (over 5 minutes) | FR-009 deletes history rows, and remapping to Due Diligence erases which rows were Deep Assessment. | Same as #160: preserving the old stage in a new column would add an expand step for a value the product has chosen to forget. |
| C5: the drop release's data deletion is gated by release order, not a flag                        | The deletion is a one-shot PRE_DEPLOY migration, which a runtime flag can't gate.                   | The drop PR merges only after the retire release's C6 signal is checked (the gate task), with a pre-deploy backup to restore. |
| Each release ships backend and frontend together                                                  | The refusal and the pickers have to change together, as in #160.                                    | Maintainer's choice of one branch per issue stage.                                                                            |
