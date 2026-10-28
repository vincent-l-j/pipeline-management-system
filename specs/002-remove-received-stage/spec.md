# Feature Specification: Remove the Received Pipeline Stage

**Feature Branch**: `002-remove-received-stage`

**Created**: 2026-10-28

**Status**: Draft

**Input**: GitHub issue #160, "Remove the Received pipeline stage". Nobody uses Received: in
practice a pitch starts at Initial Screen, so the column sits empty and adds a step for no
reason. Roll it out in two separately deployed stages, so the destructive change only happens
once the app has been confirmed working without the stage.

## Clarifications

### Session 2026-10-28

- Q: Until the data migration runs, how does a pitch still sitting in Received show on the
  board? → A: The board shows a "Received (retired)" column only while it holds pitches. Cards
  can be moved out of it, but nothing can be moved into it. List views, badges and the pitch
  detail page keep showing the Received label.
- Q: When Received is dropped, how should stage-history entries that mention it read? → A:
  Every mention of Received becomes Initial Screen. A history entry that then records a move
  from a stage to the same stage (Initial Screen → Initial Screen) is deleted, because it no
  longer records a change.
- Q: How are the two rollout stages shipped? → A: As separate pull requests deployed
  separately. Retiring the stage in the app ships first; the migration ships only after the
  first has been observed working in production.

## User Scenarios & Testing _(mandatory)_

The users are Rozetta staff working the pipeline: admins and assessors who create pitches and
move them between stages, and viewers who read the board, lists and reports.

### User Story 1 - New pitches start at Initial Screen and nothing enters Received (Priority: P1)

An assessor logs a new pitch. It lands at Initial Screen, which is where the team actually
starts work. Received is no longer offered anywhere a stage can be chosen, and the system
refuses to put a pitch into Received even if asked directly, so the retired stage cannot fill
up again.

**Why this priority**: This is the change the issue asks for, and it stops new data being
written into the stage before the stage is removed.

**Independent Test**: Create a pitch without choosing a stage and check it is at Initial
Screen; ask the system to create a pitch at Received and to move a pitch to Received, and check
both are refused with nothing changed.

**Acceptance Scenarios**:

1. **Given** an assessor creating a pitch without choosing a stage, **When** the pitch is
   saved, **Then** it is at Initial Screen and its history records it entering Initial Screen.
2. **Given** a request to create a pitch at Received, **When** it is submitted, **Then** it is
   refused with a message saying Received is retired, and no pitch is created.
3. **Given** a pitch at any stage, **When** someone asks to move it to Received, **Then** the
   move is refused with a message saying Received is retired, and the pitch's stage and
   history are unchanged.
4. **Given** the pipeline board, **When** an assessor opens a card's stage menu, **Then**
   Received is not offered.
5. **Given** the pipeline filters, the reports stage filter or the dashboard stage breakdown,
   **When** no pitch is in Received, **Then** Received does not appear in any of them.

---

### User Story 2 - Pitches already in Received stay visible and can be moved on (Priority: P1)

Some pitches may still be sitting in Received when the change ships. Until the migration runs,
a user can still find them, see that they are in Received, and move them on.

**Why this priority**: Without it, retiring the stage would hide live pitches, which the issue
rules out.

**Independent Test**: With one pitch in Received, open the board, list views, the pitch detail
page, the dashboard and the reports, and check the pitch shows up in each with the Received
label; move it out of the retired column and check the column disappears.

**Acceptance Scenarios**:

1. **Given** at least one pitch in Received, **When** a user opens the pipeline board, **Then**
   a column labelled "Received (retired)" shows those pitches.
2. **Given** no pitch in Received, **When** a user opens the pipeline board, **Then** there is
   no Received column.
3. **Given** a pitch in the retired column, **When** an assessor drags it, or picks a stage
   from its stage menu, to another stage, **Then** it moves there, and once the last such
   pitch has moved the retired column disappears.
4. **Given** the retired column, **When** an assessor drags a pitch from another column onto
   it, **Then** the pitch stays where it was and its stage is unchanged.
5. **Given** a pitch in Received, **When** a user views it in the pitches list, the pipeline
   list view, the pitch detail page or the reports summary table, **Then** it is shown with a
   Received label.
6. **Given** a pitch in Received, **When** a user views the dashboard stage breakdown, **Then**
   Received appears with its count, so the breakdown still adds up to the total.

---

### User Story 3 - Received is removed for good (Priority: P2)

Once retiring the stage has been running in production and nothing has written Received, the
remaining Received pitches are moved to Initial Screen and Received is removed from the stage
vocabulary, so no code path or data needs to account for it any more.

**Why this priority**: It completes the removal, but it is destructive and is only safe after
User Stories 1 and 2 have been observed in production. It ships separately.

**Independent Test**: On a copy of the data with pitches in Received and history entries
mentioning it, apply the change and check no pitch or history entry mentions Received, the
moved pitches are at Initial Screen, and only the history entries that became no-op moves were
removed.

**Acceptance Scenarios**:

1. **Given** pitches in Received, **When** the change is applied, **Then** each is at Initial
   Screen and every other field of the pitch is unchanged.
2. **Given** a history entry recording a pitch's creation into Received, **When** the change
   is applied, **Then** it records creation into Initial Screen, with its date, author and note
   unchanged.
3. **Given** a history entry recording a move from Received to Initial Screen, **When** the
   change is applied, **Then** that entry is removed.
4. **Given** a history entry recording a move from Received to any stage other than Initial
   Screen, **When** the change is applied, **Then** it records a move from Initial Screen to
   that stage, with its date, author and note unchanged.
5. **Given** the change has been applied, **When** anyone asks the system to use Received,
   **Then** it is refused as an unknown stage, and the "Received (retired)" column no longer
   exists.

---

### Edge Cases

- A pitch moved into Received by an older browser tab still open from before the release: the
  request is refused, and the board puts the card back where it was.
- A pitch in Received is filtered by stage on the pipeline page: the filter doesn't offer
  Received, so the user finds it in the retired column or by clearing the filter.
- A pitch moved from Received straight to a stage other than Initial Screen, then later to
  Initial Screen: after the migration, its first history entry reads Initial Screen → that
  stage, and the later move into Initial Screen is kept, because it is a real change.
- A pitch moved from another stage into Received (say Discovery Meeting → Received) before the
  retirement shipped: after the migration that entry reads Discovery Meeting → Initial Screen
  and is kept, because it is a real change.
- A pitch whose only history entry is its creation into Received: after the migration it has
  one entry, creation into Initial Screen.
- A pitch created at Received, then moved Received → Initial Screen → Received → Initial
  Screen before the retirement shipped: every Received → Initial Screen entry becomes a
  no-op move and is removed, and the Initial Screen → Received entry becomes Initial Screen
  → Initial Screen and is also removed.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A pitch created without a stage MUST start at Initial Screen.
- **FR-002**: The system MUST refuse to create a pitch at Received, and MUST refuse any stage
  change to Received, with a message naming Received as retired. A refused request changes
  nothing.
- **FR-003**: Pitches already in Received MUST still load, display and be movable to any
  active stage.
- **FR-004**: Received MUST NOT be offered as a choice in any stage picker or stage filter.
- **FR-005**: The pipeline board MUST show a "Received (retired)" column while, and only
  while, at least one pitch is in Received. Pitches can leave it; nothing can be dropped into
  it.
- **FR-006**: Every view that labels a pitch's stage (pitches list, pipeline list, pitch
  detail, reports summary table) MUST keep labelling Received pitches as Received.
- **FR-007**: The dashboard stage breakdown MUST include Received, with its count, while at
  least one pitch is in Received, and MUST omit it otherwise.
- **FR-008**: The product overview MUST describe the board's stages without Received.
- **FR-009**: Once FR-001 to FR-007 have been observed in production, a separately shipped
  change MUST move every pitch in Received to Initial Screen and change every mention of
  Received in stage history to Initial Screen.
- **FR-010**: That change MUST delete the history entries that mentioned Received and, after
  FR-009, record a move from a stage to the same stage. Every other history entry, including
  any same-stage entry that never mentioned Received, keeps its date, author and note.
- **FR-011**: That change MUST remove Received from the stage vocabulary, after which a
  request naming Received is refused as an unknown stage, and the retired-column behaviour of
  FR-005 is removed.

### Key Entities

- **Pitch**: has a current stage. After User Story 1 its stage is never newly set to Received.
- **Stage history entry**: records a pitch moving from one stage (or from nothing, on
  creation) to another, with a date, author and note. User Story 3 rewrites and prunes the
  entries that mention Received.
- **Pipeline stage**: one of the board's stages. Received is _retired_ (still valid for
  existing pitches but never chosen) after User Story 1, and gone after User Story 3.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: After the first release, zero pitches enter Received, whether created there or
  moved there, over the observation period.
- **SC-002**: After the first release, every pitch that was in Received is still reachable
  from the board in one step (the retired column), with none missing from the lists.
- **SC-003**: After the migration, zero pitches and zero history entries mention Received.
- **SC-004**: The migration deletes exactly the history entries that mentioned Received and,
  once Received reads as Initial Screen, record a move from a stage to the same stage. No
  other entry is deleted.
- **SC-005**: The board offers one fewer stage to choose from, with no change to how the
  other stages are used.

## Assumptions

- The observation period between the two releases is decided by the maintainer when deploying.
  The first release names the signal to watch.
- Received keeps its existing colour in the retired column and badges. Only the "(retired)"
  wording is new.
- Nobody outside the app (imports, scripts) writes Received. If something does, the refusal in
  FR-002 surfaces it during the observation period.
- The reports "advanced to assessment" metric never counted Received, so it is unaffected.
- #161 (merge Deep Assessment into Due Diligence) follows the same plan for a different stage.
  The two features are specified separately and land as separate pull requests.
- #132 (printing the board) counts the board's ten stages. That issue's numbers go stale; it
  isn't changed here.
