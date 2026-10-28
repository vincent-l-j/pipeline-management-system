# Tasks: Remove the Received Pipeline Stage

**Input**: Design documents from `specs/002-remove-received-stage/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/stage-api.md](contracts/stage-api.md)

**Tests**: Required (AGENTS.md: tests first). Each test task is written and seen failing
before the implementation task after it.

**Releases**: Phases 2–4 are the **retire** release (branch `002-remove-received-stage`),
closed by its own polish tasks. Phase 5 is the **drop** release (branch
`002-remove-received-stage-drop`), with its own polish tasks. The drop branch must not merge
until the gate task T020 is done.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

No setup: no new dependencies, commands or project structure.

## Phase 2: Foundational

- [x] T001 Add `RETIRED_STAGES: frozenset[PipelineStage] = frozenset({PipelineStage.RECEIVED})` beside `PipelineStage` in `backend/app/models/pitch.py`, with a one-line comment on what retired means (still loads, never accepted as a target)
- [x] T002 [P] Add `retired?: true` to the `PipelineStage` interface, set it on the `received` entry, and export `ACTIVE_STAGES` (entries without the flag, in order) and `isRetiredStage(key)` in `frontend/src/components/pipeline/PipelineConfig.ts`; extend `frontend/src/components/pipeline/__tests__/PipelineConfig.test.ts` first: `ACTIVE_STAGES` is `PIPELINE_STAGES` minus `received` in order, `isRetiredStage("received")` is true and an active key is false, and `STAGE_MAP.received.label` is still "Received"

**Checkpoint**: shared retirement markers exist; no behaviour has changed yet.

## Phase 3: User Story 1 - New pitches start at Initial Screen and nothing enters Received (P1) MVP

**Goal**: No new data enters Received.

**Independent Test**: create a pitch with no stage → `initial_screen`; create at `received`
→ 422; move to `received` → 422 with history unchanged; the stage menu and filters offer no
Received.

### Tests (write first, see them fail)

- [x] T003 [US1] In `backend/tests/test_pitches.py`: a pitch created without a stage is at `initial_screen` and its only history row is `from_stage: null → initial_screen`; `POST /api/pitches` with `current_stage: "received"` → 422 whose detail mentions `received` and `retired`, and the list of pitches is unchanged; `POST /api/pitches/{id}/stage` with `new_stage: "received"` → 422 with the same message, and the pitch's stage and history are unchanged. Update the existing tests that assume the old default: `test_create_pitch`, `test_patch_stage_immutable_leaves_stage_and_writes_no_history`, `test_stage_history_recorded`, `test_stage_change_records_from_to_and_actor` in `backend/tests/test_pitches.py`, and `test_create_pitch_succeeds` in `backend/tests/test_no_trailing_slash.py`. Retarget the tests that move a new pitch to `initial_screen` (`test_stage_transition`, `test_assessor_can_change_stage`, the stage move in `test_delete_pitch_removes_dependent_rows`) to `discovery_meeting`, so they still exercise a real transition
- [x] T004 [P] [US1] New `frontend/src/components/pipeline/__tests__/PitchCard.stageMenu.test.tsx` rendering the real `PitchCard` inside the real `AuthProvider` (admin user seeded in `localStorage`) and a `MemoryRouter`, with the real `PipelineConfig`: opening the stage menu (context menu) on an `initial_screen` card offers every active stage except the current one and no "Received"; on a `received` card it offers every active stage
- [x] T005 [P] [US1] In `frontend/src/components/pipeline/__tests__/PipelineFilters.test.tsx`: remove the `PIPELINE_STAGES` override from the `PipelineConfig` mock so the stage filter reads the real stages; retarget "calls onChange when stage filter changes" to an active stage; add: the stage filter offers no "Received" option
- [x] T006 [P] [US1] New `frontend/src/pages/__tests__/ReportsPage.test.tsx` (api mock per the plan's recorded C3 exception): with one pitch in `received` and one in `initial_screen`, the stage filter offers Initial Screen but no Received (this case fails first; the empty case already passes because the filter hides zero-count stages), and the summary table still lists the Received pitch with a "Received" badge under "All stages"

### Implementation

- [x] T007 [US1] In `backend/app/schemas/pitch.py`: default `PitchCreate.current_stage` to `PipelineStage.INITIAL_SCREEN`, and add a field validator on `PitchCreate.current_stage` and `PitchStageUpdate.new_stage` that raises `ValueError` naming the stage as retired when it is in `RETIRED_STAGES`; in `backend/app/models/pitch.py` change the `current_stage` column default to `PipelineStage.INITIAL_SCREEN`
- [x] T008 [P] [US1] Use `ACTIVE_STAGES` for the stage menu in `frontend/src/components/pipeline/PitchCard.tsx` and the stage filter in `frontend/src/components/pipeline/PipelineFilters.tsx`
- [x] T009 [P] [US1] Skip retired stages (`isRetiredStage`) when building the stage filter options in `frontend/src/pages/ReportsPage.tsx`

**Checkpoint**: T003–T006 pass.

## Phase 4: User Story 2 - Pitches already in Received stay visible and can be moved on (P1)

**Goal**: A pitch already in Received is never hidden and can leave.

**Independent Test**: with a pitch in Received, the board shows "Received (retired)" holding
it and refusing drops; every list and the dashboard still show it; once it moves, the column
disappears.

### Tests (write first, see them fail)

- [x] T010 [US2] In `backend/tests/test_pitches.py`: a pitch whose stage is set to `RECEIVED` directly in the database (the API refuses it) still loads via `GET /api/pitches/{id}` and the list, and `POST /api/pitches/{id}/stage` to `initial_screen` succeeds with a history row `received → initial_screen`
- [x] T011 [P] [US2] Make `frontend/src/test/mocks/dnd.ts` (third-party stub) pass `isDropDisabled` through as a `data-drop-disabled` attribute on the droppable element. Then new `frontend/src/components/pipeline/__tests__/KanbanColumn.retired.test.tsx`, with no inline dnd mock (so the shared stub applies) and the real `PipelineConfig`, `AuthProvider` and `MemoryRouter`: the Received stage's heading reads "Received (retired)" and its drop area is drop-disabled; an active stage's heading has no "(retired)" and its drop area is not
- [x] T012 [P] [US2] New `frontend/src/components/pipeline/__tests__/KanbanBoard.retired.test.tsx` rendering the real `KanbanColumn` and `PitchCard` (real `PipelineConfig`, `AuthProvider`, `MemoryRouter`): with no pitch in `received` there is no "Received (retired)" heading and the first heading is Initial Screen; with one there is, first, holding that pitch. Update the existing `frontend/src/components/pipeline/__tests__/KanbanBoard.test.tsx` column-count/order tests to expect the active stages when no pitch is in `received`
- [x] T013 [P] [US2] In `frontend/src/pages/__tests__/DashboardPage.test.tsx`: the breakdown lists Received with its count when `stage_counts.received > 0` and omits it when it is 0 or absent; update "lists every pipeline stage, zeroing the ones with no pitches" accordingly

### Implementation

- [x] T014 [US2] In `frontend/src/components/pipeline/KanbanBoard.tsx` render a column for each stage that is active, or retired with at least one pitch
- [x] T015 [US2] In `frontend/src/components/pipeline/KanbanColumn.tsx` label a retired stage "{label} (retired)" and pass `isDropDisabled={stage.retired === true}` to `Droppable`
- [x] T016 [P] [US2] In `frontend/src/pages/DashboardPage.tsx` skip a retired stage whose count is 0 in the breakdown
- [x] T017 [US2] Confirm T010 passes with no backend change beyond T007, and that the pitch detail page and pipeline list view keep their Received labels (`STAGE_MAP` is unchanged; their existing tests cover them) and the pitches list keeps its own label table (FR-006)

### Retire release polish and gate

- [x] T018 [P] Update `README.md`'s pipeline board line to the stages the board now shows (Initial Screen first, nine stages)
- [x] T019 Run `npm run lint`, `npm run typecheck`, `npm run format:check`, the backend and frontend suites, then drive the app per `quickstart.md` ("Retire release") and `docs/agents/local-testing.md`
- [ ] T020 Gate (after deploy, maintainer): check the retire release's C6 signal in production (plan.md): zero history rows entering `RECEIVED` since the deploy, and the board loading. Only then may the drop branch merge

**Checkpoint**: retire release complete.

## Phase 5: User Story 3 - Received is removed for good (P2), drop release

**Prerequisite**: T020 done. Branch `002-remove-received-stage-drop`.

### Tests (write first, see them fail)

- [ ] T021 [US3] In `backend/tests/migrations/test_migrations.py` add a data-safety test pinned to the new revision and its parent: seed at the parent a pitch in `RECEIVED`, a pitch in another stage, and history rows `null→RECEIVED`, `RECEIVED→INITIAL_SCREEN`, `RECEIVED→DISCOVERY_MEETING`, `DISCOVERY_MEETING→RECEIVED`, `INITIAL_SCREEN→RECEIVED`, `RECEIVED→RECEIVED` and a pre-existing `PARKED→PARKED`; upgrade; assert the pitch is at `INITIAL_SCREEN` with other fields intact, `null→RECEIVED` reads `null→INITIAL_SCREEN`, `RECEIVED→DISCOVERY_MEETING` reads `INITIAL_SCREEN→DISCOVERY_MEETING`, `DISCOVERY_MEETING→RECEIVED` reads `DISCOVERY_MEETING→INITIAL_SCREEN`, the three no-op rows are gone, `PARKED→PARKED` remains, and every kept row's `changed_at`, `changed_by_id` and `note` are unchanged. Then downgrade to the parent and assert the documented losses: `RECEIVED` is a valid label again, the pitch stays at `INITIAL_SCREEN`, and the deleted rows stay absent
- [ ] T022 [P] [US3] In `backend/tests/test_pitches.py`: `new_stage: "received"` and `current_stage: "received"` → 422 as unknown values

### Implementation

- [ ] T023 [US3] New migration `backend/alembic/versions/<rev>_drop_received_stage.py` per research.md R6 (delete the no-op rows, then remap, then `op.sync_enum_values` over `pitches.current_stage`, `pitch_stage_history.from_stage`, `pitch_stage_history.to_stage`); the docstring states the downgrade is lossy and names the restore path (pre-deploy backup, then redeploy the previous commit)
- [ ] T024 [US3] Remove `PipelineStage.RECEIVED` and its `RETIRED_STAGES` entry in `backend/app/models/pitch.py`; drop the validator only if `RETIRED_STAGES` is empty; update backend tests that use `RECEIVED`: `_seed_connected_graph` in `backend/tests/migrations/test_migrations.py`, `backend/tests/test_pitches.py`, and `test_velocity_stage_counts_all_stages` in `backend/tests/test_reports.py`
- [ ] T025 [P] [US3] Remove the `received` entries from `frontend/src/components/pipeline/PipelineConfig.ts`, `frontend/src/pages/PitchesPage.tsx`, `frontend/src/pages/DashboardPage.tsx` and `frontend/src/pages/ReportsPage.tsx`, and the `received` fixtures in frontend tests; keep the `retired` machinery only while another stage still uses it

### Drop release polish

- [ ] T026 [P] Update the docs naming Received: the `pipelinestage` row of the enum table in `sop/instances/rozetta-pms.md`, the example wire value in `docs/best-practices/database-integration.md`, and `README.md` if it still names Received
- [ ] T027 Run lint, typecheck, format check and both suites (including the migration suite), then drive the app per `quickstart.md` ("Drop release")

**Checkpoint**: drop release complete.

## Dependencies

- T001 → T007; T002 → T008, T009, T014–T016.
- US1 and US2 share only the foundational markers and can proceed in parallel after Phase 2.
- US3 depends on T020 (retire release shipped and observed). Separate branch.

## Parallel examples

- After Phase 2: T004, T005, T006 together; then T008, T009 together.
- US2: T011, T012, T013 together; then T014/T015 (same component pair) and T016.

## Implementation Strategy

MVP is US1 + US2 together, since US1 alone would hide existing Received pitches. Ship the
retire release, observe it (T020), then implement and ship US3 from its own branch.

## Phase 6: Convergence

- [x] T028 [US2] In `frontend/src/pages/__tests__/DashboardPage.test.tsx` add the case where `stage_counts` has no `received` key at all (Received is omitted), assert the Received tile shows its count when it is above 0, and rename "lists every pipeline stage, zeroing the ones with no pitches" and its comment so they no longer claim every stage always holds its place per US2/AC6, FR-007 (partial)
- [x] T029 Remove the comments that restate the retired-stage rule in `frontend/src/components/pipeline/KanbanBoard.tsx` (above `columns`) and `frontend/src/pages/DashboardPage.tsx` (inside the breakdown filter), which the code, tests and spec already carry per docs/best-practices/code-clarity.md (contradicts)
