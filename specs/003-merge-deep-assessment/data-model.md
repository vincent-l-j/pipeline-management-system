# Data Model: Merge Deep Assessment into Due Diligence

No table or column changes. The `pipelinestage` enum type changes in the drop release.

| Release                  | `pipelinestage` members                             | Deep Assessment                                                     |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------- |
| Before                   | as left by #160's retire release (Received retired) | active                                                              |
| Retire                   | unchanged                                           | in `RETIRED_STAGES`: loads and displays, never accepted as a target |
| Drop (after #160's drop) | `DEEP_ASSESSMENT` removed (type recreated)          | gone; a request naming it is an unknown value (422)                 |

## Pitch

- Validation (retire): `PitchCreate.current_stage ∉ RETIRED_STAGES` (now includes
  `DEEP_ASSESSMENT`).
- Drop migration: `DEEP_ASSESSMENT` → `DUE_DILIGENCE`. No other field changes.

## PitchStageHistory

- Validation (retire): `PitchStageUpdate.new_stage ∉ RETIRED_STAGES`.
- Drop migration, in order:
  1. Delete the rows where (`from_stage = DEEP_ASSESSMENT` and `to_stage ∈ {DEEP_ASSESSMENT,
DUE_DILIGENCE}`) or (`from_stage = DUE_DILIGENCE` and `to_stage = DEEP_ASSESSMENT`).
  2. Set `from_stage` and `to_stage` `DEEP_ASSESSMENT` → `DUE_DILIGENCE`.
  3. `changed_at`, `changed_by_id` and `note` are never modified.
