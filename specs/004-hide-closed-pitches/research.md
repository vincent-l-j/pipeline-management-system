# Research: Hide Long-Closed Pitches from the Pipeline

## R1. Where "entered the stage" comes from

- **Decision**: Derive it from `pitch_stage_history`: the latest `changed_at` among the pitch's
  rows whose `to_stage` equals its current stage, falling back to `created_at`. Nothing is
  stored.
- **Rationale**: Every create and stage change already writes a history row (the audit
  invariant on `PitchUpdate`), so the history is the source of truth. A stored column would
  duplicate it and need a backfill migration. The fallback covers data that predates the
  history.
- **Alternatives**: `updated_at` changes on any edit, not only stage changes. A new
  `stage_changed_at` column would need a migration, a backfill and a second write on every
  stage change.

## R2. Where it's computed

- **Decision**: In `app/api/routes/pitches.py`, a `_stage_entered_at(db, pitches)` lookup runs
  one grouped query (`pitch_stage_history` joined to `pitches` on id with `to_stage =
current_stage`, grouped by pitch) for the pitches in the response, and `_as_out` sets the
  field, alongside `decline_reason`. Every route that returns a `PitchOut` fills it.
- **Rationale**: The same pattern as `decline_reason` (`latest_assessment_by_pitch`): a
  derived, read-only field computed per request in one query, so the list doesn't become N+1.
- **Schema shape**: `PitchOut` declares it `datetime | None = None`, as `decline_reason` is
  declared, because `_as_out` builds the model from the ORM object (which has no such
  attribute) and fills the field afterwards. Every response sets it, so the contract's "never
  null" holds, and the tests assert it.
- **Alternatives**: A `column_property` on `Pitch` would run a correlated subquery on every
  pitch load across the app (reports, search, exports), which don't need it.

## R3. Where the rule runs

- **Decision**: On the client, in a pure `isLongClosed(pitch, now, thresholdDays)` in
  `components/pipeline/closedPitches.ts`, with `CLOSED_PITCH_HIDE_AFTER_DAYS = 90` passed in by
  `PipelinePage`. Hidden means `current_stage` is `declined` or `completed` and `now -
stage_entered_at > thresholdDays` days.
- **Rationale**: Only one page hides (the clarified scope), and it needs both the visible
  pitches and the hidden count, which one unfiltered fetch gives. The per-user follow-up
  replaces the constant with the user's setting fetched from the server, and the rule doesn't
  change (FR-007).
- **Alternatives**: A server-side `?exclude_closed=true` would need a second request or a
  count header to show N, and would put a Pipeline-only presentation rule on a shared
  endpoint.

## R4. The toggle

- **Decision**: A native `button` with `aria-pressed`, shown only when at least one pitch is
  hidden or hidden pitches are being shown. It reads "Show N hidden" when hiding, and "Hide
  closed over 90 days" when showing. Its state is `?closed=show` in the URL via
  `useSearchParams`; absent means hide.
- **Rationale**: FR-004, FR-005, A4 and A7. A default of "hide" keeps the default URL clean.
  The label is built from the threshold argument, not a literal 90 (FR-007).
- **Count**: the header counts the fetched pitches minus the hidden ones, or all of them while
  shown. It stays independent of the other filters, as today (FR-006).

## R6. Moves on the board (FR-009)

- **Decision**: `PipelinePage.handlePitchMoved` sets `stage_entered_at` to the current time
  along with `current_stage`.
- **Rationale**: The board updates optimistically and ignores the response. Without this, a
  shown long-closed pitch moved Completed → Declined keeps its old time and disappears as
  soon as hiding is back on. When the board rolls back a failed move, it calls the same
  handler, which also sets the time to now: until the next load that pitch is treated as
  recently entered and stays visible. Erring towards visible is safe, and the next fetch
  corrects it.
- **Robustness**: `isLongClosed` checks the stage before it reads the date, so a pitch that
  isn't closed never depends on the field.

## R5. A5 paydown on the Pipeline page

- **Decision**: The page's fetch gains a request timeout (axios `timeout` on the two calls)
  and an error state with copy and a "Try again" button that refetches. Before this feature,
  a failed fetch showed an empty board.
- **Rationale**: A5 says a view a plan touches gains a timeout and a retry. The page is
  touched by this plan.
