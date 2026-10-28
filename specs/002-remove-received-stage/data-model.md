# Data Model: Remove the Received Pipeline Stage

No table or column changes. The `pipelinestage` enum type changes in the drop release.

## PipelineStage (enum `pipelinestage`)

| Release | Members                                                                                   | Received                                                            |
| ------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Today   | RECEIVED, INITIAL_SCREEN, DISCOVERY_MEETING, DEEP_ASSESSMENT, DUE_DILIGENCE, …, COMPLETED | default for new pitches                                             |
| Retire  | unchanged                                                                                 | in `RETIRED_STAGES`: loads and displays, never accepted as a target |
| Drop    | RECEIVED removed (type recreated)                                                         | gone; a request naming it is an unknown value (422)                 |

## Pitch

- `current_stage`: default becomes `INITIAL_SCREEN` (model and `PitchCreate`).
- Validation (retire): `PitchCreate.current_stage ∉ RETIRED_STAGES`.
- Drop migration: `RECEIVED` → `INITIAL_SCREEN`. No other field changes.

## PitchStageHistory

- Validation (retire): `PitchStageUpdate.new_stage ∉ RETIRED_STAGES`, so no new row has
  `to_stage = RECEIVED`.
- Drop migration, in order:
  1. Delete the rows where (`from_stage = RECEIVED` and `to_stage ∈ {RECEIVED, INITIAL_SCREEN}`)
     or (`from_stage = INITIAL_SCREEN` and `to_stage = RECEIVED`).
  2. Set `from_stage` and `to_stage` `RECEIVED` → `INITIAL_SCREEN`. A creation row
     (`from_stage` NULL) keeps NULL.
  3. `changed_at`, `changed_by_id` and `note` are never modified.

## Stage lifecycle

```text
active ──(retire release)──▶ retired ──(drop release)──▶ removed
          refused as a target        rows remapped, value dropped
          still loads and displays
```
