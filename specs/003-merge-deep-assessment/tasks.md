# Tasks: Merge Deep Assessment into Due Diligence

**Input**: Design documents from `specs/003-merge-deep-assessment/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/stage-api.md](contracts/stage-api.md); #160's
retire release (`specs/002-remove-received-stage/`) in the branch below this one.

**Tests**: Required. Each test task is written and seen failing before its implementation.

**Releases**: Phases 2–4 are the **retire** release (branch `003-merge-deep-assessment`).
Phase 5 is the **drop** release (branch `003-merge-deep-assessment-drop`, stacked on
`002-remove-received-stage-drop`). It must not merge until the gate task T014 is done.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

No setup.

## Phase 2: Foundational

No foundational work: #160 built the retirement mechanism.

## Phase 3: User Story 1 - Nothing enters Deep Assessment any more (P1) MVP

**Independent Test**: create at and move to `deep_assessment` → 422 with nothing changed; no
stage menu or filter offers it.

### Tests (write first, see them fail)

- [x] T001 [P] [US1] In `backend/tests/test_pitches.py`: `POST /api/pitches` with `current_stage: "deep_assessment"` → 422 whose detail mentions `deep_assessment` and `retired`, with no pitch created; `POST /api/pitches/{id}/stage` with `new_stage: "deep_assessment"` → 422 with the same message, and the stage and history unchanged
- [x] T002 [P] [US1] In `frontend/src/components/pipeline/__tests__/PipelineConfig.test.ts`: `ACTIVE_STAGES` excludes `deep_assessment` as well as `received`, `isRetiredStage("deep_assessment")` is true, and `STAGE_MAP.deep_assessment.label` is still "Deep Assessment"
- [x] T003 [P] [US1] In `frontend/src/components/pipeline/__tests__/PitchCard.stageMenu.test.tsx`, `PipelineFilters.test.tsx` and `frontend/src/pages/__tests__/ReportsPage.test.tsx`: the stage menu offers Due Diligence and no "Deep Assessment"; the pipeline filter offers no "Deep Assessment"; the reports filter offers no Deep Assessment even with a pitch in it, while the summary table still shows that pitch with a "Deep Assessment" badge (add a `deep_assessment` row to the summary fixture, and update its `total` and the existing "All stages (2)" assertion to match)

### Implementation

- [x] T004 [US1] Add `PipelineStage.DEEP_ASSESSMENT` to `RETIRED_STAGES` in `backend/app/models/pitch.py`
- [x] T005 [US1] Set `retired: true` on the `deep_assessment` entry in `frontend/src/components/pipeline/PipelineConfig.ts`

**Checkpoint**: T001–T003 pass.

## Phase 4: User Story 2 - Pitches already in Deep Assessment stay visible and can be moved on (P1)

**Independent Test**: with a pitch in Deep Assessment, the board shows its retired column in
place and refuses drops; every list and the dashboard still show it and count it as advanced;
once it moves, the column disappears.

### Tests (write first, see them fail where behaviour is new)

- [x] T006 [P] [US2] In `backend/tests/test_pitches.py`: a pitch set to `DEEP_ASSESSMENT` directly in the database still loads in the detail and the list, and moves to `due_diligence` with a history row `deep_assessment → due_diligence`
- [x] T007 [P] [US2] In `backend/tests/test_reports.py`: a pitch in `DEEP_ASSESSMENT` (set directly in the database) is counted in `conversion.advanced_to_assessment` (passes before and after; pins FR-006 against the drop release's edit)
- [x] T008 [P] [US2] In `frontend/src/components/pipeline/__tests__/KanbanColumn.retired.test.tsx`: the Deep Assessment stage's heading reads "Deep Assessment (retired)" and its drop area is drop-disabled
- [x] T009 [P] [US2] In `frontend/src/components/pipeline/__tests__/KanbanBoard.retired.test.tsx`: with no pitch in `deep_assessment` there is no "Deep Assessment (retired)" heading and Discovery Meeting is followed by Due Diligence; with one there is, between them, holding that pitch; with pitches in both retired stages both retired columns show, each in place
- [x] T010 [P] [US2] In `frontend/src/pages/__tests__/DashboardPage.test.tsx`: the breakdown omits Deep Assessment when its count is 0 and lists it when it isn't (the fixture's `deep_assessment: 2` covers the second)

### Implementation

- [x] T011 [US2] No production change beyond T004/T005 is expected; confirm T006–T010 pass, and that the pitches list, list view, detail page and reports table keep the Deep Assessment label

### Retire release polish and gate

- [x] T012 [P] Update `README.md`'s pipeline board line to eight stages
- [x] T013 Run lint, typecheck, format check, the backend, frontend and browser suites, then drive the app per `quickstart.md` ("Retire release")
- [ ] T014 Gate (after deploy, maintainer): check the retire release's C6 signal in production (plan.md): zero history rows entering `DEEP_ASSESSMENT` since the deploy, the board loading, and "advanced to assessment" unchanged across the deploy. Only then may the drop branch merge

## Phase 5: User Story 3 - Deep Assessment is merged away for good (P2), drop release

**Prerequisite**: T014 done, and #160's drop branch below this one. Branch
`003-merge-deep-assessment-drop`.

### Tests (write first, see them fail)

- [x] T015 [US3] In `backend/tests/migrations/test_migrations.py` add a data-safety test pinned to the new revision and its parent: seed at the parent with raw SQL (the ORM's `PipelineStage` no longer has the value), like `test_split_contact_name_preserves_existing_names`: a pitch in `DEEP_ASSESSMENT`, a pitch elsewhere, and history rows `null→DEEP_ASSESSMENT`, `DISCOVERY_MEETING→DEEP_ASSESSMENT`, `DEEP_ASSESSMENT→DUE_DILIGENCE`, `DUE_DILIGENCE→DEEP_ASSESSMENT`, `DEEP_ASSESSMENT→DEEP_ASSESSMENT`, `DEEP_ASSESSMENT→PARKED` and a pre-existing `DUE_DILIGENCE→DUE_DILIGENCE`; upgrade; assert the pitch is at `DUE_DILIGENCE` with other fields intact, `null→DEEP_ASSESSMENT` reads `null→DUE_DILIGENCE`, `DISCOVERY_MEETING→DEEP_ASSESSMENT` reads `DISCOVERY_MEETING→DUE_DILIGENCE`, `DEEP_ASSESSMENT→PARKED` reads `DUE_DILIGENCE→PARKED`, the three no-op rows are gone, the pre-existing `DUE_DILIGENCE→DUE_DILIGENCE` remains, the number of pitches in the stages "advanced to assessment" counts is the same before and after (SC-005), and kept rows' `changed_at`, `changed_by_id` and `note` are unchanged. Downgrade to the parent and assert the documented losses: `DEEP_ASSESSMENT` is a valid label again, the pitch stays at `DUE_DILIGENCE`, and the deleted rows stay absent
- [x] T016 [P] [US3] In `backend/tests/test_pitches.py`: `deep_assessment` as `current_stage` or `new_stage` → 422 as an unknown value; in `backend/tests/test_reports.py` retarget T007's pitch to `DUE_DILIGENCE` (still counted)

### Implementation

- [x] T017 [US3] New migration `backend/alembic/versions/<rev>_merge_deep_assessment_stage.py` per research.md R3, with a docstring stating the downgrade is lossy and naming the restore path
- [x] T018 [US3] Remove `PipelineStage.DEEP_ASSESSMENT` in `backend/app/models/pitch.py` and from `active_stages` in `backend/app/api/routes/reports.py`; with `RETIRED_STAGES` now empty, delete it and the validator in `backend/app/schemas/pitch.py` along with the retired-stage refusal tests (the unknown-value tests replace them); update `test_velocity_stage_counts_all_stages` in `backend/tests/test_reports.py`
- [x] T019 [P] [US3] Remove `deep_assessment` from `frontend/src/components/pipeline/PipelineConfig.ts`, `frontend/src/pages/PitchesPage.tsx`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/ReportsPage.tsx`, and fixtures in frontend tests (including `ListPages.browser.test.tsx` and `DashboardPage.browser.test.tsx`); then delete the retirement mechanism per research.md R4: the `retired` field, `ACTIVE_STAGES`, `isRetiredStage`, the board's conditional column, the column's label and drop guard, the dashboard and reports checks, the dnd stub pass-through, and the `*.retired.test.tsx` files. Production users of `ACTIVE_STAGES` (`PitchCard.tsx`, `PipelineFilters.tsx`) go back to `PIPELINE_STAGES`. Tests to update or delete with the mechanism: `KanbanBoard.test.tsx` (`ACTIVE_STAGES` imports, the "retired" test name), `PipelineFilters.test.tsx` (the retired-stage case), `PipelineConfig.test.ts` (the `retired stages` block and its imports), `ReportsPage.test.tsx` (the whole file tests the retired filter; delete it), and `DashboardPage.test.tsx` (the retired-tile and omission cases; and switch every `findByText("Deep Assessment")` load wait to a stage that remains, e.g. "Due Diligence"). Keep `PitchCard.stageMenu.test.tsx`, retargeted to `PIPELINE_STAGES`

### Drop release polish

- [x] T020 [P] Update `sop/instances/rozetta-pms.md`'s `pipelinestage` row
- [x] T021 Tell the maintainer that the untracked local seed `.exclude/seed_dev_data.py` uses `PipelineStage.DEEP_ASSESSMENT` and will fail after the drop. Run lint, typecheck, format check, all suites including the migration and browser suites, then drive the app per `quickstart.md` ("Drop release")

## Dependencies

- Tests before their implementation: T001 → T004; T002, T003, T008–T010 → T005.
- US3 depends on T014 and on #160's drop release.

## Implementation Strategy

US1 + US2 ship together as the retire release, as in #160. Observe it (T014), then ship US3.
