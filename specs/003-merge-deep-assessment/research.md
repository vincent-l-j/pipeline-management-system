# Research: Merge Deep Assessment into Due Diligence

The retirement mechanism, its testing approach and the migration shape come from
[#160's research](../002-remove-received-stage/research.md) (R1, R3, R4, R5, R6). Only what
differs is recorded here.

## R1. Reuse, not repeat

- **Decision**: Add `PipelineStage.DEEP_ASSESSMENT` to `RETIRED_STAGES` and `retired: true` to
  the `deep_assessment` entry in `PIPELINE_STAGES`. No other production code changes in the
  retire release.
- **Rationale**: #160 built the behaviour as a property of membership, so the second member
  costs only its marker. Tests are added per stage, because each stage's visible behaviour
  (its own column and its own label) is what the spec asks for.

## R2. "Advanced to assessment"

- **Decision**: Leave `active_stages` in `reports.py` unchanged in the retire release, so
  pitches still in Deep Assessment are counted (FR-006). In the drop release remove
  `DEEP_ASSESSMENT` from the list, since its pitches are then in Due Diligence, which is
  already counted (SC-005).
- **Time-in-stage**: none exists. `velocity_metrics` reports stage counts, monthly intake,
  conversion and 30-day activity counts, and only the activity count reads history (a row
  count, unaffected by which stage a row names). So the merged history needs no metric work.

## R3. Drop migration

- **Decision**: As #160's R6, with Due Diligence as the target:
  1. `UPDATE pitches SET current_stage='DUE_DILIGENCE' WHERE current_stage='DEEP_ASSESSMENT'`.
  2. Delete the history rows where (`from_stage='DEEP_ASSESSMENT'` and `to_stage IN
('DEEP_ASSESSMENT','DUE_DILIGENCE')`) or (`from_stage='DUE_DILIGENCE'` and
     `to_stage='DEEP_ASSESSMENT'`).
  3. Remap the remaining `DEEP_ASSESSMENT` in `from_stage` and `to_stage` to `DUE_DILIGENCE`.
  4. `op.sync_enum_values` without `DEEP_ASSESSMENT` (and without `RECEIVED`, already gone).
- **Downgrade**: re-add `DEEP_ASSESSMENT` in its original position; data not restored.

## R4. Deleting the retirement mechanism

- **Decision**: In the drop release, once both stages are gone, remove `RETIRED_STAGES`, the
  schema validator, the `retired` field, `ACTIVE_STAGES`, `isRetiredStage`, the board's
  conditional column, the column's "(retired)" label and drop guard, the dashboard filter,
  the reports skip, and the dnd stub's pass-through along with the tests that exercise them.
  Pickers go back to `PIPELINE_STAGES`.
- **Rationale**: C1. A mechanism with no members is a speculative abstraction. If a stage is
  retired again later, the history shows how to rebuild it.
