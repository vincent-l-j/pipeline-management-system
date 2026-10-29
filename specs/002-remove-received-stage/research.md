# Research: Remove the Received Pipeline Stage

## R1. Where the refusal lives

- **Decision**: A Pydantic field validator on `PitchCreate.current_stage` and
  `PitchStageUpdate.new_stage` refuses any stage in `RETIRED_STAGES` (a `frozenset` beside
  `PipelineStage` in `app/models/pitch.py`). FastAPI turns it into a 422 whose message names
  the stage as retired.
- **Rationale**: Schemas are the request allowlist (golden rule 6), so a value the client may
  no longer send belongs there. A 422 matches how the API already refuses unknown enum values,
  so the drop release's "unknown stage" refusal is the same status. One set serves #161, which
  adds `DEEP_ASSESSMENT` to it.
- **Alternatives**: A check in the route handlers would duplicate across create and stage
  change. Removing the value from the request enum would mean a second enum type for requests,
  which is a wider change than a validator, and it is deleted again in the drop release anyway.

## R2. Default stage

- **Decision**: `PitchCreate.current_stage` and the model column default both become
  `INITIAL_SCREEN`. The frontend never sends a stage on create (`pitchForm.ts`), so it changes
  nothing there.
- **Rationale**: FR-001. The model default matters to code that builds a `Pitch` directly
  (tests, seeds).

## R3. How the frontend knows a stage is retired

- **Decision**: `PipelineStage` (frontend config type) gains an optional `retired?: true`.
  Received keeps its place, colour and label in `PIPELINE_STAGES`, with `retired: true`.
  `ACTIVE_STAGES` (the entries without the flag) feeds the stage menu and the pipeline filter.
  `isRetiredStage(key)` is used by the dashboard and the reports filter, which keep their own
  stage tables. `STAGE_MAP` still covers every stage, so badges and detail pages still label
  Received.
- **Rationale**: Keeping Received in the ordered list means the board shows the retired
  column in its original first position, with no second ordering to maintain. The flag goes
  away in the drop release along with the entry.
- **Alternatives**: A separate `RETIRED_STAGES` array would make the board merge two lists to
  place the column. Asking the API which stages are retired would be new surface for a
  temporary state.

## R4. Showing and protecting the retired column

- **Decision**: `KanbanBoard` renders a stage's column if it's active, or if it's retired and
  at least one pitch is in it. `KanbanColumn` labels a retired stage "Received (retired)" and
  passes `isDropDisabled` to `Droppable`, so the library refuses drops onto it. Cards in it
  stay draggable, and their stage menu lists the active stages.
- **Rationale**: FR-005. Disabling the drop at the library level means no optimistic move
  happens, so there's nothing to revert. The backend refusal is the security boundary anyway
  (golden rule 2).
- **Stage menu on a retired card**: built from the active stages, it has no "Current" row
  for Received. That's acceptable: the column heading already says where the card is.
- **Testing**: jsdom can't drag. The local dnd stub (a stand-in for a third-party library,
  which C3 allows) passes `isDropDisabled` through as a `data-drop-disabled` attribute, so a
  `KanbanColumn` test can assert it. The drag itself is checked by driving the app.

## R5. Dashboard and reports

- **Decision**: The dashboard breakdown skips a retired stage whose count is 0. The reports
  stage filter skips retired stages entirely, though their pitches stay in the table under
  "All stages".
- **Rationale**: FR-007 keeps the breakdown summing to the total. FR-004 says a filter never
  offers Received.

## R6. Drop migration shape

- **Decision**: One hand-written revision:
  1. `UPDATE pitches SET current_stage='INITIAL_SCREEN' WHERE current_stage='RECEIVED'`.
  2. Delete the history rows that mention Received and would become no-op moves:
     `from_stage='RECEIVED' AND to_stage IN ('RECEIVED','INITIAL_SCREEN')`, or
     `from_stage='INITIAL_SCREEN' AND to_stage='RECEIVED'`.
  3. Remap the remaining mentions: `from_stage` and `to_stage` `'RECEIVED'` →
     `'INITIAL_SCREEN'`.
  4. `op.sync_enum_values('public', 'pipelinestage', <values without RECEIVED>, [the three
columns])`, which recreates the type.
- **Downgrade**: `sync_enum_values` back to the full list, with `RECEIVED` first. The data is
  not restored. The docstring says so and names the restore path: the pre-deploy backup.
- **Rationale**: Postgres can't drop an enum label in place. The project's enum hook already
  recreates the type (see `e6a4d81c37b2`). Deleting before remapping means step 2 can tell the
  rows that mentioned Received from pre-existing same-stage rows, which FR-010 keeps.

## R7. The drop release's code

- **Decision**: Remove `PipelineStage.RECEIVED` and its `RETIRED_STAGES` entry (the set
  stays if #161's entry is in it). Remove Received from `PIPELINE_STAGES`, the stage tables
  in `PitchesPage`, `DashboardPage` and `ReportsPage`, and from tests. Existing tests that
  build history through Received are updated to start at Initial Screen.
- **Ordering with #161**: the stack is 160-retire → 161-retire → 160-drop → 161-drop, so the
  160 drop release finds `DEEP_ASSESSMENT` still retired. It removes only Received.
