# Tasks: Hide Long-Closed Pitches from the Pipeline

**Input**: Design documents from `specs/004-hide-closed-pitches/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/pitch-out.md](contracts/pitch-out.md)

**Tests**: Required. Each test task is written and seen failing before its implementation.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

No setup.

## Phase 2: Foundational - when a pitch entered its stage

**Goal**: every `PitchOut` carries `stage_entered_at` (FR-002, FR-008). Both stories need it.

- [ ] T001 In `backend/tests/test_pitches.py` (write first): a new pitch's `stage_entered_at` equals its creation history row's `changed_at`; after a stage change it equals the new row's `changed_at`; after `PATCH` it is unchanged; for a pitch moved Declined → Parked → Declined it is the latest move into Declined; with the pitch's history rows deleted directly in the database it falls back to `created_at`; in `GET /api/pitches` each pitch carries its own value; a viewer can read it; sending it in `PATCH` doesn't change it. Backdate rows with direct database writes where a known time is needed
- [ ] T002 Add `stage_entered_at: datetime | None = None` to `PitchOut` in `backend/app/schemas/pitch.py` as a read-only derived field, declared like `decline_reason` (filled in by `_as_out` after `model_validate`, so it can't be required), and absent from `PitchCreate`/`PitchUpdate`; T001 asserts it is never null in any response
- [ ] T003 In `backend/app/api/routes/pitches.py` add `_stage_entered_at(db, pitches) -> dict[UUID, datetime]` (one grouped query over `pitch_stage_history` joined to `pitches` on `to_stage = current_stage`), and have `_as_out` set `stage_entered_at` (falling back to `created_at`) in every route that returns a `PitchOut`, using one lookup for the whole list
- [ ] T004 [P] Add `stage_entered_at: string` to `Pitch` in `frontend/src/types.ts`, and add it to the typed fixtures that then fail typecheck: `KanbanBoard.test.tsx`, `KanbanBoard.retired.test.tsx`, `PitchCard.test.tsx`, `PitchCard.stageMenu.test.tsx`, `KanbanColumn.test.tsx`, `KanbanColumn.retired.test.tsx` and `PipelineListView.test.tsx` in `frontend/src/components/pipeline/__tests__/`, plus the untyped `PITCH` in `frontend/src/pages/__tests__/ListPages.browser.test.tsx`, which renders the Pipeline page

**Checkpoint**: T001 passes; typecheck clean.

## Phase 3: User Story 1 - The pipeline shows live work, not old closed pitches (P1) MVP

**Independent Test**: with recently and long-closed pitches, the board and list view show only
the recent ones, and the header count matches.

### Tests (write first, see them fail)

- [ ] T005 [P] [US1] New `frontend/src/components/pipeline/__tests__/closedPitches.test.ts` (pure, no mocks), with a fixed `now`: `declined` and `completed` entered 91 days ago → hidden; exactly 90 days → shown; 1 day → shown; every other stage at 365 days → shown, including one with no `stage_entered_at` at all; the threshold argument is respected (e.g. 30 days hides a 31-day-old decline)
- [ ] T006 [US1] New `frontend/src/pages/__tests__/PipelinePage.test.tsx` (api mock per the plan's C3 exception, `Layout` stubbed as in other page tests, wrapped in `MemoryRouter` and the real `AuthProvider`): with one long-declined, one long-completed, one recently declined and one long-parked pitch, the board shows only the last two, the list view likewise, and the header says "2 initiatives in the pipeline"; choosing Declined in the stage filter shows only the recent decline; the page passes a `timeout` option to its `api.get` calls; it shows a loading message before the response, and its empty-board copy with no pitches at all

### Implementation

- [ ] T007 [US1] New `frontend/src/components/pipeline/closedPitches.ts`: `CLOSED_PITCH_HIDE_AFTER_DAYS = 90` and `isLongClosed(pitch, now, thresholdDays)` per data-model.md
- [ ] T008 [US1] In `frontend/src/pages/PipelinePage.tsx` drop long-closed pitches before the existing filters and sort, and count only the shown pitches in the header

**Checkpoint**: T005, T006 pass.

## Phase 4: User Story 2 - Hidden pitches stay reachable (P1)

**Independent Test**: the page offers "Show N hidden"; showing them puts them back; the choice
survives a reload via the URL; other views are unchanged.

### Tests (write first, see them fail)

- [ ] T009 [US2] In `frontend/src/pages/__tests__/PipelinePage.test.tsx`: with two hidden pitches a button "Show 2 hidden" with `aria-pressed="false"` shows; pressing it shows them on the board, sets `?closed=show`, the header count includes them, and the button now reads "Hide closed over 90 days" (built from the threshold) with `aria-pressed="true"`; rendering at `/pipeline?closed=show` shows them from the start; with nothing hidden there is no button; with every pitch hidden the page still shows the button and its count
- [ ] T010 [US2] In `frontend/src/pages/__tests__/PipelinePage.test.tsx`: a failed or timed-out pitches request shows an error message and a "Try again" button instead of an empty board, and pressing it refetches and renders the board (A5)
- [ ] T011 [P] [US2] In `backend/tests/test_search.py` and `backend/tests/test_reports.py`: a pitch declined more than 90 days ago (backdated in the database) is still returned by search, the pipeline summary and the pitches CSV export, pinning FR-003 (pass before and after)

- [ ] T016 [US2] In `frontend/src/pages/__tests__/PipelinePage.test.tsx`: with hidden pitches shown, moving a long-completed pitch to Declined through its stage menu keeps it on the board after hiding is switched back on (FR-009)

### Implementation

- [ ] T012 [US2] In `frontend/src/pages/PipelinePage.tsx` add the toggle per research.md R4, with its state in `useSearchParams` (`closed=show`), placed with the page's filter controls
- [ ] T017 [US2] In `frontend/src/pages/PipelinePage.tsx` make `handlePitchMoved` also set `stage_entered_at` to the current time, per research.md R6
- [ ] T013 [US2] In `frontend/src/pages/PipelinePage.tsx` add a timeout to the two fetches and an error state with a "Try again" button that refetches, per research.md R5

**Checkpoint**: T009–T011 and T016 pass.

## Phase 5: Polish

- [ ] T014 [P] Update `README.md`'s pipeline board line to mention that declined and completed pitches leave the board 90 days after closing, with a toggle to show them
- [ ] T015 Run lint, typecheck, format check, the backend, frontend and browser suites, then drive the app per `quickstart.md` at 390, 768 and 1280 wide

## Dependencies

- T001 → T002, T003; T004 → T005–T013 (typed field).
- US1 → US2 (the toggle needs the hiding to toggle).

## Implementation Strategy

One release: Phase 2, then US1, then US2, then polish. After deploy, check the plan's C6
signal.
