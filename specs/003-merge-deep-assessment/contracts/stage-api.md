# Contract: stage values on the pitch API

The same shape as [#160's contract](../../002-remove-received-stage/contracts/stage-api.md),
for `deep_assessment`.

| Request                                                                             | Retire release                                                        | Drop release           |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------- |
| `POST /api/pitches` with `current_stage: "deep_assessment"`                         | 422, detail contains `deep_assessment` and `retired`; nothing written | 422 (not a valid enum) |
| `POST /api/pitches/{id}/stage` with `new_stage: "deep_assessment"`                  | 422, same message; stage and history unchanged                        | 422 (not a valid enum) |
| `POST /api/pitches/{id}/stage` from a pitch in `deep_assessment` to an active stage | 200                                                                   | n/a                    |

## Responses

`PitchOut.current_stage`, `StageHistoryOut.from_stage/to_stage`, `stage_counts` and the
summary's `current_stage` may contain `"deep_assessment"` in the retire release, and never do
after the drop release. `conversion.advanced_to_assessment` counts `deep_assessment` pitches
in the retire release, and gives the same total after the drop.
