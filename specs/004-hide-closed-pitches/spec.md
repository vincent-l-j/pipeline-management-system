# Feature Specification: Hide Long-Closed Pitches from the Pipeline

**Feature Branch**: `004-hide-closed-pitches`

**Created**: 2026-10-28

**Status**: Draft

**Input**: GitHub issue #162, "Hide declined and completed pitches after 90 days". Declined
and Completed pitches pile up and crowd out live work. Hide (never delete) pitches whose stage
has been Declined or Completed for more than 90 days, measured from when the pitch entered
that stage, not from when it was created. Hidden pitches must stay reachable. 90 days is a
fixed default for now. A follow-up feature will make the threshold configurable per user,
stored server-side, so the filter should be designed for a per-user value to replace the
constant later.

## Clarifications

### Session 2026-10-28

- Q: Which views hide long-closed pitches? → A: The Pipeline page only (the board and its list
  view), which is where the crowding is. Every other view, including the Pitches list, search,
  pitch detail pages, the dashboard, reports and CSV exports, is unchanged and keeps showing
  them.

### Session 2026-10-29

- Q: What should the Pipeline page's toggle say? → A: "Show old pitches" while long-closed
  pitches are hidden, and "Hide old pitches" while they are shown. This confirms the toggle,
  which was the implementer's proposal, and drops the count from it.

## User Scenarios & Testing _(mandatory)_

The users are Rozetta staff working the pipeline: admins and assessors who move pitches
through stages, and viewers who read the board.

### User Story 1 - The pipeline shows live work, not old closed pitches (Priority: P1)

A user opens the Pipeline page. Pitches that were declined or completed more than 90 days ago
aren't on the board or in its list view, so the Declined and Completed columns hold only
recent outcomes and the rest of the board is easier to scan.

**Why this priority**: It is the change the issue asks for.

**Independent Test**: With pitches declined or completed both recently and more than 90 days
ago, open the Pipeline page in board and list view, and check only the recent ones appear,
with nothing deleted.

**Acceptance Scenarios**:

1. **Given** a pitch that entered Declined 91 days ago, **When** a user opens the Pipeline
   page, **Then** it appears neither on the board nor in the list view.
2. **Given** a pitch that entered Completed 91 days ago, **When** a user opens the Pipeline
   page, **Then** it is hidden the same way.
3. **Given** a pitch that entered Declined or Completed 90 days ago or less, **When** a user
   opens the Pipeline page, **Then** it appears as usual.
4. **Given** a pitch created more than 90 days ago that entered Declined last week, **When** a
   user opens the Pipeline page, **Then** it appears, because the time counts from entering
   the stage.
5. **Given** a pitch in any other stage, however long it has been there, **When** a user opens
   the Pipeline page, **Then** it appears.
6. **Given** a pitch that was declined more than 90 days ago and has since moved back into an
   active stage, **When** a user opens the Pipeline page, **Then** it appears.
7. **Given** hidden pitches, **When** a user reads the Pipeline page's count of initiatives,
   **Then** it counts every pitch except the hidden ones; once hidden pitches are shown, it
   counts them too. The stage, source, domain and lead filters don't change it, as today.

---

### User Story 2 - Hidden pitches stay reachable (Priority: P1)

A user looking for an old declined pitch can still find it. The Pipeline page offers to show
the pitches it is hiding. Every other view still lists them as
before.

**Why this priority**: Hiding must not lose anything. The issue requires hidden pitches to
stay reachable. The other views already keep them reachable; the Pipeline page's own toggle
keeps them discoverable from the page that hides them.

**Independent Test**: With one long-closed pitch, check the Pipeline page offers to show it,
that showing it puts it back on the board, that the setting survives a reload and a shared
link, and that the pitch is in the Pitches list, search, its detail page, the dashboard
counts, the reports and the CSV export.

**Acceptance Scenarios**:

1. **Given** at least one hidden pitch, **When** a user opens the Pipeline page, **Then** it
   offers a "Show old pitches" control.
2. **Given** no hidden pitch, **When** a user opens the Pipeline page, **Then** there is no
   such notice or control.
3. **Given** hidden pitches, **When** the user chooses to show them, **Then** they appear on
   the board and in the list view, and the control reads "Hide old pitches".
4. **Given** the user has chosen to show hidden pitches, **When** they reload the page or
   share its link, **Then** the hidden pitches are still shown.
5. **Given** a hidden pitch, **When** a user opens the Pitches list, searches for it, opens its
   detail page by link, or reads the dashboard, reports or CSV export, **Then** it is there,
   exactly as before this feature.

---

### Edge Cases

- A pitch with no record of when it entered its current stage (older data with no matching
  history entry): its creation time is used instead.
- A pitch moved Declined → Parked → Declined: the time counts from the most recent entry into
  Declined.
- A hidden pitch is dragged nowhere, because it isn't on the board. Once shown, it can be moved
  like any other pitch, and moving it into an active stage keeps it visible after the user
  hides closed pitches again.
- Stage, source, domain and lead filters apply after hiding: a user filtering to Declined sees
  only the recent declined pitches unless they have chosen to show hidden ones.
- A pitch exactly 90 days into Declined is shown. Only more than 90 days hides it.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The Pipeline page (board and list view) MUST hide every pitch whose current
  stage is Declined or Completed and which entered that stage more than 90 days ago.
- **FR-002**: The time a pitch entered its current stage MUST be the most recent recorded move
  into that stage, or the pitch's creation time if there is none.
- **FR-003**: Hiding MUST NOT delete or change any pitch, and MUST NOT affect any view other
  than the Pipeline page.
- **FR-004**: While it hides any pitch, the Pipeline page MUST offer a control labelled "Show
  old pitches", which shows them and then reads "Hide old pitches" until it hides them again.
  The control is reachable by keyboard and announced by a screen reader.
- **FR-005**: Whether hidden pitches are shown MUST be part of the page's address, so it
  survives a reload and a shared link.
- **FR-006**: The Pipeline page's initiative count MUST exclude the pitches it is hiding, and
  include them while they are shown.
- **FR-007**: The 90-day threshold MUST be a single value the hiding rule takes as an input, so
  a later per-user setting can supply it without changing the rule. The toggle's copy doesn't
  name the threshold, so it needs no change either.
- **FR-009**: A pitch moved on the board MUST count as having just entered its new stage, so
  moving a shown long-closed pitch into the other closed stage doesn't hide it.
- **FR-008**: The system MUST provide, for each pitch, the time it entered its current stage,
  to any user who can already read the pitch.

### Key Entities

- **Pitch**: gains a derived, read-only "entered current stage at" time (FR-002). Nothing is
  stored.
- **Hiding rule**: a pitch is hidden when its stage is Declined or Completed and it entered
  that stage more than the threshold ago. The threshold is 90 days for now.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On the Pipeline page, zero pitches that have been Declined or Completed for more
  than 90 days are shown by default, so those columns hold only the last 90 days' outcomes.
- **SC-002**: Zero pitches are deleted or changed by hiding: every pitch reachable before the
  release is reachable after it from the same views, apart from the Pipeline page's default
  view.
- **SC-003**: A user can bring every hidden pitch back onto the Pipeline page in one action.

## Assumptions

- "More than 90 days" compares the time the pitch entered the stage with the current time.
  Calendar days and time zones don't matter at this resolution.
- Search, the Pitches list, detail pages, the dashboard, reports and exports already list every
  pitch; this feature leaves them as they are.
- The per-user threshold, and where it's stored, is the separate follow-up feature in the
  issue. This feature only makes it a plain input to the hiding rule.
- The pipeline's other filters (stage, source, domain, lead, sort) keep their current
  behaviour. Moving them into the address is out of scope.
