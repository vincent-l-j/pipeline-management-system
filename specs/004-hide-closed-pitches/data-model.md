# Data Model: Hide Long-Closed Pitches from the Pipeline

No schema change.

## PitchOut (response only)

| Field              | Type                      | Rule                                                                                                                                                                                           |
| ------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage_entered_at` | datetime (timezone-aware) | max `pitch_stage_history.changed_at` where `pitch_id` = the pitch and `to_stage` = its `current_stage`; else the pitch's `created_at`. Read-only: absent from `PitchCreate` and `PitchUpdate`. |

## Hiding rule (client)

`isLongClosed(pitch, now, thresholdDays)` is true when:

- `pitch.current_stage ∈ {"declined", "completed"}`, and
- `now − pitch.stage_entered_at > thresholdDays × 24 h`.

`thresholdDays` is `CLOSED_PITCH_HIDE_AFTER_DAYS` (90) today, and a per-user setting later.

## Pipeline page URL state

| Param    | Values | Meaning                            |
| -------- | ------ | ---------------------------------- |
| `closed` | absent | hide long-closed pitches (default) |
| `closed` | `show` | show them                          |
