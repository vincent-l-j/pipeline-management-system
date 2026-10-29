# Feature Specification: Merge Deep Assessment into Due Diligence

**Feature Branch**: `003-merge-deep-assessment`

**Created**: 2026-10-28

**Status**: Draft

**Input**: GitHub issue #161, "Merge Deep Assessment into Due Diligence". Users can't tell
Deep Assessment from Due Diligence, so the two stages get used inconsistently. Drop Deep
Assessment and keep Due Diligence. Roll it out in two separately deployed stages, so the
destructive change only happens once the app has been confirmed working without the stage.

## Clarifications

### Session 2026-10-28

- Q: Until the data migration runs, how does a pitch still sitting in Deep Assessment show on
  the board? → A: The same way as Received in #160 (`specs/002-remove-received-stage/`): the
  board shows a "Deep Assessment (retired)" column only while it holds pitches. Cards can be
  moved out of it, but nothing can be moved into it. List views, badges and the pitch detail
  page keep showing the Deep Assessment label.
- Q: When Deep Assessment is dropped, how should stage-history entries that mention it read?
  → A: Every mention of Deep Assessment becomes Due Diligence. A history entry that mentioned
  Deep Assessment and then records a move from a stage to the same stage (Due Diligence → Due
  Diligence) is deleted, because it no longer records a change.
- Q: How are the two rollout stages shipped? → A: As separate pull requests deployed
  separately, after #160's matching release in each case. Retiring the stage in the app ships
  first; the migration ships only after the first has been observed working in production.
- The issue asks whether the stage-velocity or time-in-stage metrics on the Reports page need
  the merged history. Checked against the code: the app has no time-in-stage metric. The only figure that reads stages
  directly is "advanced to assessment", which already counts both stages, so after the merge
  it gives the same number. Nothing else needs the merged history.

## User Scenarios & Testing _(mandatory)_

The users are Rozetta staff working the pipeline: admins and assessors who move pitches
between stages, and viewers who read the board, lists and reports.

### User Story 1 - Nothing enters Deep Assessment any more (Priority: P1)

An assessor moving a pitch past Discovery Meeting has one choice, Due Diligence, so the team
stops splitting the same work across two stages. Deep Assessment is no longer offered anywhere
a stage can be chosen, and the system refuses to put a pitch into it even if asked directly.

**Why this priority**: This is the change the issue asks for, and it stops new data being
written into the stage before the stage is removed.

**Independent Test**: Ask the system to create a pitch at Deep Assessment and to move a pitch
to Deep Assessment, and check both are refused with nothing changed. Check that no stage menu
or filter offers it.

**Acceptance Scenarios**:

1. **Given** a request to create a pitch at Deep Assessment, **When** it is submitted,
   **Then** it is refused with a message saying Deep Assessment is retired, and no pitch is
   created.
2. **Given** a pitch at any stage, **When** someone asks to move it to Deep Assessment,
   **Then** the move is refused with a message saying Deep Assessment is retired, and the
   pitch's stage and history are unchanged.
3. **Given** the pipeline board, **When** an assessor opens a card's stage menu, **Then** Deep
   Assessment is not offered and Due Diligence is.
4. **Given** the pipeline filter or the reports stage filter, **When** a user opens it,
   **Then** Deep Assessment is not offered, even while some pitch is in it.

---

### User Story 2 - Pitches already in Deep Assessment stay visible and can be moved on (Priority: P1)

Pitches may still be sitting in Deep Assessment when the change ships. Until the migration
runs, a user can still find them, see that they are in Deep Assessment, and move them on.

**Why this priority**: Without it, retiring the stage would hide live pitches, which the issue
rules out.

**Independent Test**: With one pitch in Deep Assessment, open the board, list views, the
pitch detail page, the dashboard and the reports, and check the pitch shows up in each with
the Deep Assessment label; move it out of the retired column and check the column
disappears.

**Acceptance Scenarios**:

1. **Given** at least one pitch in Deep Assessment, **When** a user opens the pipeline board,
   **Then** a column labelled "Deep Assessment (retired)" shows those pitches, in Deep
   Assessment's usual place between Discovery Meeting and Due Diligence.
2. **Given** no pitch in Deep Assessment, **When** a user opens the pipeline board, **Then**
   there is no Deep Assessment column.
3. **Given** a pitch in the retired column, **When** an assessor drags it, or picks a stage
   from its stage menu, to another stage, **Then** it moves there, and once the last such
   pitch has moved the retired column disappears.
4. **Given** the retired column, **When** an assessor drags a pitch from another column onto
   it, **Then** the pitch stays where it was and its stage is unchanged.
5. **Given** a pitch in Deep Assessment, **When** a user views it in the pitches list, the
   pipeline list view, the pitch detail page or the reports summary table, **Then** it is
   shown with a Deep Assessment label.
6. **Given** a pitch in Deep Assessment, **When** a user views the dashboard stage breakdown,
   **Then** Deep Assessment appears with its count, so the breakdown still adds up to the
   total; with none there, it doesn't appear.
7. **Given** pitches in Deep Assessment, **When** a user reads the "advanced to assessment"
   figure on the dashboard or reports, **Then** those pitches are still counted.

---

### User Story 3 - Deep Assessment is merged away for good (Priority: P2)

Once retiring the stage has been running in production and nothing has written Deep
Assessment, the remaining Deep Assessment pitches are moved to Due Diligence and Deep
Assessment is removed from the stage vocabulary.

**Why this priority**: It completes the merge, but it is destructive and is only safe after
User Stories 1 and 2 have been observed in production. It ships separately.

**Independent Test**: On a copy of the data with pitches in Deep Assessment and history
entries mentioning it, apply the change and check no pitch or history entry mentions Deep
Assessment, the moved pitches are at Due Diligence, and only the history entries that became
no-op moves were removed.

**Acceptance Scenarios**:

1. **Given** pitches in Deep Assessment, **When** the change is applied, **Then** each is at
   Due Diligence and every other field of the pitch is unchanged.
2. **Given** a history entry recording a move from Discovery Meeting to Deep Assessment,
   **When** the change is applied, **Then** it records a move from Discovery Meeting to Due
   Diligence, with its date, author and note unchanged.
3. **Given** a history entry recording a move from Deep Assessment to Due Diligence, or from
   Due Diligence to Deep Assessment, **When** the change is applied, **Then** that entry is
   removed.
4. **Given** a history entry recording a move from Deep Assessment to any stage other than
   Due Diligence, **When** the change is applied, **Then** it records a move from Due
   Diligence to that stage, with its date, author and note unchanged.
5. **Given** the change has been applied, **When** anyone asks the system to use Deep
   Assessment, **Then** it is refused as an unknown stage, and the "Deep Assessment
   (retired)" column no longer exists.
6. **Given** the change has been applied, **When** a user reads the "advanced to assessment"
   figure, **Then** it shows the same number as before the change.

---

### Edge Cases

- A move to Deep Assessment from an older browser tab still open from before the release: the
  request is refused, and the board puts the card back where it was.
- A pitch created directly at Deep Assessment (possible before the release): after the
  migration, its creation entry reads creation into Due Diligence.
- A history entry that was already Due Diligence → Due Diligence before the migration and
  never mentioned Deep Assessment is kept.
- Both retired stages hold pitches at once (Received from #160 and Deep Assessment): both
  retired columns show, each in its own usual place.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST refuse to create a pitch at Deep Assessment, and MUST refuse any
  stage change to Deep Assessment, with a message naming Deep Assessment as retired. A
  refused request changes nothing.
- **FR-002**: Pitches already in Deep Assessment MUST still load, display and be movable to
  any active stage.
- **FR-003**: Deep Assessment MUST NOT be offered as a choice in any stage picker or stage
  filter.
- **FR-004**: The pipeline board MUST show a "Deep Assessment (retired)" column while, and
  only while, at least one pitch is in Deep Assessment. Pitches can leave it; nothing can be
  dropped into it.
- **FR-005**: Every view that labels a pitch's stage MUST keep labelling Deep Assessment
  pitches as Deep Assessment, and the dashboard stage breakdown MUST include Deep Assessment,
  with its count, only while at least one pitch is in it.
- **FR-006**: The "advanced to assessment" figure MUST keep counting pitches in Deep
  Assessment.
- **FR-007**: The product overview MUST describe the board's stages without Deep Assessment.
- **FR-008**: Once FR-001 to FR-006 have been observed in production, a separately shipped
  change MUST move every pitch in Deep Assessment to Due Diligence and change every mention of
  Deep Assessment in stage history to Due Diligence.
- **FR-009**: That change MUST delete the history entries that mentioned Deep Assessment and,
  after FR-008, record a move from a stage to the same stage. Every other history entry keeps
  its date, author and note.
- **FR-010**: That change MUST remove Deep Assessment from the stage vocabulary, after which a
  request naming it is refused as an unknown stage, and the retired-column behaviour of
  FR-004 is removed for it.

### Key Entities

- **Pitch**: has a current stage. After User Story 1 its stage is never newly set to Deep
  Assessment.
- **Stage history entry**: records a pitch moving from one stage (or from nothing, on
  creation) to another, with a date, author and note. User Story 3 rewrites and prunes the
  entries that mention Deep Assessment.
- **Pipeline stage**: Deep Assessment is _retired_ after User Story 1 and gone after User
  Story 3. Due Diligence absorbs it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: After the first release, zero pitches enter Deep Assessment over the observation
  period.
- **SC-002**: After the first release, every pitch that was in Deep Assessment is still
  reachable from the board in one step, with none missing from the lists.
- **SC-003**: After the migration, zero pitches and zero history entries mention Deep
  Assessment.
- **SC-004**: The migration deletes exactly the history entries that mentioned Deep
  Assessment and, once it reads as Due Diligence, record a move from a stage to the same
  stage. No other entry is deleted.
- **SC-005**: The "advanced to assessment" figure is the same immediately before and after the
  migration.

## Assumptions

- This feature reuses #160's retirement mechanism (one set of retired stages on the server,
  one `retired` marker per stage on the client). Deep Assessment is a second member, not a
  second mechanism.
- Deep Assessment keeps its existing colour in the retired column and badges.
- Assessments (the scored records) are not tied to a stage, so they are unaffected.
- The observation period between the two releases is decided by the maintainer when
  deploying.
- #132 (printing the board) counts the board's ten stages, a number #160 already made stale;
  it isn't changed here.
