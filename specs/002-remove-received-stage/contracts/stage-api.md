# Contract: stage values on the pitch API

Only the behaviour that changes is listed. Every other field and route is unchanged.

## `POST /api/pitches`

| Request `current_stage` | Retire release                                                                  | Drop release           |
| ----------------------- | ------------------------------------------------------------------------------- | ---------------------- |
| omitted                 | 200, pitch at `initial_screen`; history row `from_stage: null → initial_screen` | same                   |
| `"received"`            | 422, detail message contains `received` and `retired`; nothing written          | 422 (not a valid enum) |
| any active stage        | 200, unchanged behaviour                                                        | same                   |

## `POST /api/pitches/{id}/stage`

| Request `new_stage` | Retire release                                                                     | Drop release           |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------- |
| `"received"`        | 422, detail message contains `received` and `retired`; stage and history unchanged | 422 (not a valid enum) |
| any active stage    | 200, also from a pitch currently in `received`                                     | same                   |

## Responses

`PitchOut.current_stage`, `StageHistoryOut.from_stage/to_stage` and the reports'
`stage_counts` / `current_stage` may still contain `"received"` in the retire release. They
never do after the drop release.
