---
description: "Task list for aligning contributor docs with the constitution"
---

# Tasks: Align Contributor Docs with the Constitution

**Input**: Design documents from `specs/001-align-docs-constitution/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: This is a docs-only feature, so there are no automated test tasks (FR-008). Each story
instead starts by running its [quickstart.md](quickstart.md) checks to see them fail on the
current text, and finishes by running them again to see them pass. That is the docs equivalent
of red, then green.

**Organization**: Grouped by user story. Each story phase is **one PR**, cut fresh from the
fetched base. The phases land in order, because several files are edited by more than one story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (a different file, and no dependency on an incomplete task)
- **[Story]**: US1–US4, from [spec.md](spec.md)
- Line numbers are as of commit `d5c96f2` and only help locate a passage. Find each passage by
  its quoted text.

## Conventions for every PR

- **Branch**: run `git fetch`, then `git checkout -b <branch> origin/main`. Never cut from a
  local, stale `main`. If an earlier PR in this list hasn't merged yet, stack on its branch.
- **Commits**: Conventional Commits with no scope (for example `docs: …`). Keep each commit to
  one concern.
- **PR body**: say why the change exists, what was verified and how, and give paths for
  anything the diff doesn't show (AGENTS.md "Version control"). Don't transcribe the diff.
- **Wording**:
  - cite constitution rules by id ("C3") and don't paraphrase them;
  - a grandfathered pattern reads "(grandfathered under Cn)" next to its description;
  - durable docs never cite task ids (`T0xx`), `VAL-` ids or `mission/` paths.
- **Before opening a PR**, run `npm run format:prettier:check`.
- **Outward-facing steps** (pushing, opening a PR, filing an issue) wait for the user's
  confirmation.
- **If a doc looks more correct than the constitution**: don't edit either one. Draft a GitHub
  issue proposing the amendment (quote the doc passage and the rule id), show it to the user,
  and file it once they confirm. In the PR, leave the doc deferring to the current rule
  (FR-009).

---

## Phase 1: Setup

**Purpose**: Record the baseline the stories will be measured against.

- [x] T001 Run [quickstart.md](quickstart.md) checks 1, 2 and 4 from the repo root and save the
      output to `/tmp/docs-alignment-baseline.txt`. It is a scratch file outside the repo.
      Confirm that the hits match research R4 and R7 (contract and `VAL-` references, broken
      links to `AGENT-READINESS.md` and `Rozetta_PMS_User_Guide.md`, and the "three UI states",
      "Prefer expand/contract" and "`api` mocked" passages).

---

## Phase 2: Foundational (blocking)

**Purpose**: Land the constitution, the Spec Kit setup and this spec on `origin/main`. Every
story PR cites the constitution, so it has to exist on the base branch first.

- [x] T002 Push `chore/specify` and open its PR to `main` after the user confirms. The branch
      holds the Spec Kit initialisation, the ratified constitution
      (`.specify/memory/constitution.md`), the deletion of `mission/contract/`, and
      `specs/001-align-docs-constitution/` (including this file). The PR body says these are
      the foundation the five docs PRs that follow build on. Commit any uncommitted changes
      under `specs/001-align-docs-constitution/` first, as `docs: plan constitution docs
alignment`.

**Checkpoint**: Once the PR is merged, or later PRs stack on it, the story phases can begin.

---

## Phase 3: User Story 1 — Guidance never instructs a constitution violation (P1) 🎯 MVP

**Goal**: No best-practices or peripheral doc recommends a forbidden or grandfathered pattern.
Grandfathered descriptions carry their rule id, and paraphrased principles become pointers
(FR-001, 002, 003, 006).

**Independent test**: [quickstart.md](quickstart.md) check 4 passes. Walk research R4 row by row
and confirm each passage is rewritten, labelled or replaced by a pointer.

**PR**: `docs/constitution-conformance`

- [x] T003 [US1] Re-run [quickstart.md](quickstart.md) check 4. Confirm that the
      "should print nothing" greps currently print hits, and that the grandfathered mentions
      currently carry no rule ids.
- [x] T004 [P] [US1] Edit `docs/best-practices/solid-principles.md`:
  - SRP (~:19-23): replace "A route that starts doing parsing or multi-step business logic
    should push that into a service" with inline-until-three-call-sites (C1).
  - OCP: reframe so adding data or config serves easy deletion, not open-ended extension (C1).
  - LSP (~:70-72): label the auth fixtures as the grandfathered current-user override (C3).
  - DIP (~:102-106): delete "That substitution is the whole reason the suite can run without
    Postgres or real tokens", because the suite runs on real Postgres. Label
    `app.dependency_overrides` of the project's own dependencies as grandfathered (C3).
  - DIP: fix `services/api.js` to `services/api.ts`.
  - DIP "Services" bullet (~:111-113): state that the notetaker reads its key from the
    environment and builds its client inline (grandfathered under C2), so it is not a DIP
    exemplar.
  - Closing section (~:123-128): change "second reason, implementation, consumer" to three
    occurrences or call sites (C1).
  - Opening: one line saying SOLID explains the conventions and the constitution governs.
- [x] T005 [P] [US1] Edit `docs/best-practices/frontend-react.md`:
  - UI states (~:66-67): "three UI states" becomes the four states (loading, error, empty,
    loaded), each tested, plus a timeout that turns a hang into the error state and a retry
    path from the error state (A5).
  - Update the `useEffect` example (~:54-63) to show the timeout and retry. Don't name an API
    the shared client doesn't have. The shared client sets no timeout (grandfathered under
    A5), so the example passes one per request.
  - Network mocking (~:212-240): present "mock the network by mocking `src/services/api`" as
    grandfathered under C3. New tests don't extend it without an exception recorded in the
    plan.
  - Role-gated UI (~:249-251): replace "render with a mocked `useAuth`" with rendering inside
    a real `AuthProvider` with seeded storage. Mocking `useAuth` isn't grandfathered (C3).
  - Request-id state (~:100-102, ~:131-136): label the mutable module-level request-id state
    in `api.ts` as grandfathered under C2.
  - Add one-line pointers where each topic already appears: native controls and no
    `<div onClick>` beside the aria-label guidance (A4); a new dependency states its size
    cost (A6); selection, filters, tab and query live in the URL, and fetched data is a
    refetched cache, beside "keep data-fetching in the page" (A7).
  - Checklist (~:376, ~:379): change "loading/empty/error states" to the four states plus
    timeout and retry, and change "`api` mocked" to "no mock of the project's own code
    without a recorded exception".
  - Inside these passages, fix `.jsx`, `.js` and `App.jsx` to `.tsx`/`.ts`, and fix
    `vitest.config.js`, `src/test/setup.js` and `src/test/mocks/dnd.js` to `.ts`.
- [x] T006 [P] [US1] Edit `docs/best-practices/backend-fastapi.md`:
  - Layout (~:14, ~:18-19): replace "reusable logic in `services/`" with "a service needs
    three call sites, otherwise inline" (C1).
  - Settings (~:156-160): label module-level settings as grandfathered under C2. Handlers
    receive settings-derived collaborators via `Depends`.
  - Logging setup (~:164-167): label `setup_logging()` at import as grandfathered under C2.
  - Logging rules (~:220-222): widen "Never f-string caller-supplied data" to all variable
    data, passed as named fields (A21).
  - Add an A21 pointer on the request-id and acting-user section (~~:305-312), and an A22
    pointer on health probes logging at DEBUG (~~:325-326).
  - Testing (~:341-347): label the fixtures that override `get_current_user` as
    grandfathered under C3.
  - Testing (~~:351-352) and the checklist (~~:428-433): add that a bug fix starts with a
    failing reproduction test (C3), that a new operation states the structured event and
    fields it emits (A21), and that the plan names its production observation signal (C6).
  - Where the notetaker is described, label it grandfathered under C2 and A16.
- [x] T007 [P] [US1] Edit `docs/best-practices/database-integration.md`:
  - Frontend testing (~:97-99): change "mock `services/api` so components are tested against
    the contract" to present the pattern as grandfathered under C3.
  - Pitfalls (~:113): frame the mock-payload drift pitfall as a cost of that grandfathered
    pattern.
  - Inside these passages, fix `src/services/api.js` (~~:9, ~~:68) to `api.ts`,
    `vite.config.js` (~~:10) to `.ts`, and `PipelineConfig.js`/`AssessmentConfig.js` (~~:30)
    to `.ts`.
  - Leave the `VAL-*` end-to-end line (~:100) alone. T025 handles it.
- [x] T008 [P] [US1] Edit `docs/best-practices/migrations.md`:
  - (~:48-50) Change "**Prefer** expand/contract" to "migrations are expand-then-contract
    (C5)".
  - (~:39-42) A lossy downgrade also names its restore path and revert time (C5).
  - Level 4 (~:90-102): label "rollback is not rehearsed during deploy" as grandfathered
    under C5.
  - Deploy section (~:122-127): point to C5.
  - Leave Level 2 steps 3-4 alone. T036 rewrites them.
- [x] T009 [P] [US1] Edit `AGENTS.md`:
  - Testing-Driven Development section: label the backend auth fixtures (~~:50-51) as
    grandfathered under C3. Change "mock `src/services/api`" (~~:53-54) to grandfathered
    under C3, with new tests not extending it without a recorded exception.
  - Frontend Conventions: add one-line A4 (native controls, no `<div onClick>`) and A7 (URL
    state in the URL) pointers.
  - Don't touch the `VAL-`, `mission/` or orchestrator wording. T021 handles it.
- [x] T010 [P] [US1] Edit `README.md`:
  - (~:12, and the AI env var row) The notetaker's env-key read and basic-parser fallback
    are grandfathered under C2. It has no eval set yet (A16).
  - Testing (~:303-309): cite the `services.yaml` `test-backend` command where it gives the
    raw `pytest` invocation.
  - (~:338-341) Label CI's `docker build --target test` for the jsdom suite as the
    grandfathered C4 gap.
  - Don't touch the user-guide link. T029 handles it.
- [x] T011 [P] [US1] Edit `docs/architecture.md`:
  - Label CI's `--target test` (~:170-171) as grandfathered under C4.
  - Label logging configured at import (~:206) as grandfathered under C2.
  - Label the notetaker env read and inline client (~:187-189) as grandfathered under C2,
    with no eval set yet (A16).
- [x] T012 [P] [US1] Edit `sop/db-change.md`:
  - Steps 1-3 (~:274-315): require an additive migration with a working downgrade, then code
    tolerant of both shapes, then a later contract step (C5).
  - Production revert (~:369-370): state the revert path (redeploy the previous commit, plus
    the downgrade or restore path) and that it takes under 5 minutes (C5).
  - "Done" (~:374-378): add "the production signal named in the plan has been checked" (C6).
- [x] T013 [US1] Re-run [quickstart.md](quickstart.md) check 4 and
      `npm run format:prettier:check`, and confirm both pass. Open PR
      `docs/constitution-conformance` after the user confirms. The PR body lists the research
      R5 conformance gaps (C4 commands, A22 alerts) as deliberately out of scope.

**Checkpoint**: US1 is complete and reviewable on its own.

---

## Phase 4: User Story 2 — Contributors can find the constitution (P2)

**Goal**: The constitution is one link from `CLAUDE.md`, precedence is stated, and the
best-practices index has a conflict rule (FR-004, FR-005).

**Independent test**: [quickstart.md](quickstart.md) check 3 passes. From `CLAUDE.md` alone, a
reader reaches the constitution in one hop.

**PR**: `docs/constitution-precedence`

- [x] T014 [P] [US2] In `CLAUDE.md`, add the precedence statement from
      [contracts/precedence-statement.md](contracts/precedence-statement.md) directly under
      "What this is". Link `.specify/memory/constitution.md`. Add a constitution bullet at the
      top of "Reference docs".
- [x] T015 [P] [US2] In `AGENTS.md`, add the same precedence statement after the opening
      paragraph, linking `.specify/memory/constitution.md`.
- [x] T016 [P] [US2] In `docs/best-practices/README.md`:
  - Add the conflict rule from [contracts/precedence-statement.md](contracts/precedence-statement.md)
    as a new rule next to rule 1 ("The code is the source of truth").
  - Reword rule 5's "Four short docs" so it doesn't count the docs (README rule 3).
- [x] T017 [US2] Run [quickstart.md](quickstart.md) check 3 and the Prettier check, and confirm
      both pass. Open PR `docs/constitution-precedence` after the user confirms.

**Checkpoint**: US1 and US2 are both complete.

---

## Phase 5: User Story 4 — Workflow docs describe the workflow in use (P2)

**Goal**: `methodology.md` describes Spec Kit, and nothing presents the contract, feature
queue, runner or `mission/` as live. The ADR is corrected append-only, the lessons are drained,
one proposal is filed and one declined, and `mission/` is deleted (FR-011 to FR-019, and
FR-020's correctness half).

**Independent test**: [quickstart.md](quickstart.md) checks 1, 2, 5 and 6 pass, plus the
check 8 cold read.

This phase lands as **two PRs**: workflow (T018–T030), then drain (T031–T041). The drain PR
needs the workflow PR's new destinations.

### PR `docs/spec-kit-workflow`

- [x] T018 [US4] Re-run [quickstart.md](quickstart.md) checks 1 and 2, and confirm the
      contract and queue hits and the two broken links are still there.
- [x] T019 [P] [US4] Rewrite `methodology.md` to match
      [contracts/methodology-outline.md](contracts/methodology-outline.md):
  - Five sections, in order. Keep "Automating a rule", including the admission bar and
    "What automates well", with "worker", "milestone" and "runner" wording removed.
  - "Proposals never block" becomes filing a `needs-triage` GitHub issue.
  - Don't restate the branch flow; point to AGENTS.md "Version control".
  - Nothing from the outline's "must not appear" list may remain.
  - Remove the `AGENT-READINESS.md` link and the `best-practices/testing.md` reference.
- [x] T020 [P] [US4] Edit `CLAUDE.md`:
  - Repository map (~:52): replace the `mission/` line with `specs/` (one folder per feature:
    spec, plan, tasks) and `.specify/` (Spec Kit templates, scripts and the constitution).
  - "How work is organized" (~:58-79): rewrite for the Spec Kit flow. Point to
    `methodology.md` for the steps, and say that a feature's `specs/<feature>/spec.md`
    acceptance scenarios define "done".
  - Golden rule 1 (~:97-99): correctness is judged against the spec's acceptance scenarios
    via `/speckit-analyze`, `/speckit-converge` and a PR review citing rule ids, never by
    the implementer alone. Done means deployed and observed (C6), not merged (FR-020).
  - Golden rule 7 (~:112): change "part of the contract" to "part of the API behaviour the
    tests assert".
  - Boundaries (~:125-128): replace the methodology, contract and queue-id sentences with
    two rules. The constitution changes only by an amendment PR. Durable files never cite
    ephemeral ids (task ids, branch names).
  - Issue tracker blurb (~:136-137): remove "Separate from the `mission/` queues…", and say
    that issues hold work not yet specified, while `specs/` holds specified features.
- [x] T021 [P] [US4] Edit `AGENTS.md`:
  - Opening (~:3-6): drop the contract and feature-queue sentence. Point to `specs/` and
    `services.yaml`.
  - Off-limits (~:32-38): replace with "the constitution (amendment PR only)" plus the
    ephemeral-id rule.
  - (~:43-45) Replace "return to the orchestrator… conflicts with an assertion in
    `mission/contract/`" with "stop and ask the user if the work can't be done within these
    boundaries or conflicts with the spec".
  - TDD (~:58-64): change the `VAL-*` bullet to "don't cite task ids in tests or comments".
    Correctness is judged against the spec's acceptance scenarios via analyze, converge and
    PR review, never self-validated.
  - New "Lessons and proposals" bullet under Test-Driven Development, pointing to
    `methodology.md`: a lesson from a defect becomes a rule in `docs/best-practices/` in the
    PR that fixes it, merged into an existing rule where possible. An idea for an automated
    check is filed as a `needs-triage` GitHub issue (FR-018).
  - Version control (~:110): change "One `mission/features/` id → one branch" to "one spec
    (or issue) → one branch".
  - Definition of Done (~:150, ~:154): change the `VAL-*` line to "every acceptance scenario
    in the feature's spec is observably satisfied on the running stack", and delete the
    "feature file is deleted" line.
- [x] T022 [P] [US4] In `docs/agents/issue-tracker.md`, replace the "Relationship to `mission/`"
      section (~:28-34) with "Relationship to `specs/`". An issue captures work that isn't
      specified yet. `/speckit-specify` turns it into `specs/<feature>/`, and the spec links
      the issue number. Ideas for automated checks are filed as `needs-triage` issues.
- [x] T023 [P] [US4] In `docs/agents/local-testing.md` (~:175), change the destination for "A
      test that passed over a bug you just watched happen" to "A rule in
      `docs/best-practices/`, in this PR (merged into an existing rule where possible)".
      Adjust the next paragraph if it refers to lessons.
- [x] T024 [P] [US4] In `docs/best-practices/README.md`:
  - Remove the closing paragraph's `mission/contract/` sentences (~:57-61).
  - Reword "a feature's `verificationSteps`" to "a feature's `tasks.md` verification steps".
- [x] T025 [P] [US4] In `docs/best-practices/database-integration.md` (~:100-103), change "the
      contract's `VAL-*` assertions are verified black-box" to "the feature spec's acceptance
      scenarios are verified on the running stack".
- [x] T026 [P] [US4] Edit the comments in `services.yaml` (comments only, no command changes):
  - Line 1: change "validators/workers use" to "contributors and CI use".
  - (~:18) Change "used by per-feature verificationSteps" to "used by `tasks.md`
    verification steps".
  - (~:72-73) Replace "(VAL-ATTACH-002)" with research R7's wording: "upload a file and
    compare the stored object's checksum with the source".
- [x] T027 [P] [US4] In `sop/instances/rozetta-pms.md` (~:140-142), replace "what closes
      VAL-ATTACH-002, by checksum" with research R7's wording. A real Space is the only proof
      an upload arrives byte-identical (compare checksums), and no automated test covers it.
- [x] T028 [P] [US4] Append to `docs/adr/0002-remove-pitch-file-links.md` the
      `## Update YYYY-MM-DD` note from [contracts/adr-note.md](contracts/adr-note.md), dated
      the day it is written. It says the cited assertions were retired on 2026-10-25, that the
      decision stands, and that the guards are `backend/tests/test_attachments.py`,
      `backend/tests/test_spaces_document_store.py` and the `PitchAttachments` component
      tests. Change no existing line.
- [x] T029 [P] [US4] In `README.md` (~:17), delete the sentence linking
      `Rozetta_PMS_User_Guide.md`. The file was deleted in an earlier cleanup.
- [x] T030 [US4] Run [quickstart.md](quickstart.md) check 1 (ignore `mission/` existing and
      the `mission/lessons` and `mission/proposals` paths, which the drain PR removes), plus
      checks 2 and 6, the Prettier check, and the check 8 cold read. Open PR
      `docs/spec-kit-workflow` after the user confirms.

### PR `docs/drain-mission-queues`

Before each merge, read the lesson file in `mission/lessons/`. Write the rule as one to three
sentences of self-contained prose, merged into the existing rule named in research R2. Don't
cite the lesson's filename.

- [x] T031 [P] [US4] In `docs/best-practices/frontend-react.md`, merge four lessons:
  - "a removal leaves no test behind": a new testing guideline near the `queryBy*` absence
    advice;
  - "fixtures smaller than production hide overflow": into "Give a layout fixture more than
    one row", including `min-w-0`;
  - "memoize effect handlers": a new Components guideline;
  - "test the behaviour, not the content": next to "assert on what the component rendered,
    not what the test arranged".
- [x] T032 [P] [US4] In `docs/best-practices/backend-fastapi.md` testing section, add a
      one-line pointer to the removal-leaves-no-test-behind rule in `frontend-react.md`.
- [x] T033 [P] [US4] In `docs/agents/local-testing.md` "The address" (~:11-33), merge "a
      shadowed port serves a different environment". Name the process that answered
      (`ss -ltnp`, `/proc/<pid>/environ`) before blaming config drift.
- [x] T034 [P] [US4] In `AGENTS.md` Version control, "Start clean", merge "branch off the
      fetched target":
  - fetch first, and cut from `origin/<base>`;
  - check ancestry with `git merge-base --is-ancestor` before stacking;
  - a non-ancestor with an empty diff means the earlier branch was squash-merged.
- [x] T035 [P] [US4] In `docs/best-practices/README.md` rule 4 (forward references), merge
      "docs cannot cite a sibling branch". A doc asserts only what is true on its own branch.
      Replace the stale "queued feature" example with a planned issue.
- [x] T036 [P] [US4] In `docs/best-practices/migrations.md` Level 2 (~:73-81), merge "pin
      migration tests to revisions". Rewrite steps 3-4 so both ends of a per-revision test are
      named revisions instead of `upgrade head` / `downgrade -1`. This matches
      `backend/tests/migrations/`.
- [x] T037 [P] [US4] In `docs/agents/issue-tracker.md` "Create an issue" (~:7), merge "search
      the tracker before filing". Search with `gh issue list --state all --search "<terms>"`,
      comment on an existing match, and close duplicates as `duplicate`.
- [x] T038 [US4] Search for an existing match, then show the user the issue from
      [contracts/issue-drafts.md](contracts/issue-drafts.md) item 1 ("Lint: an assertion must
      read a value the code under test produced"). After they confirm, file it with
      `gh issue create --label needs-triage`. Don't file item 2, which was declined.
- [x] T039 [US4] Show the user follow-up items 3–6 from
      [contracts/issue-drafts.md](contracts/issue-drafts.md): the react-hooks lint, the C4
      `services.yaml` routing, the A22 alerts, and the error-reference log test. File each one
      they confirm, searching first. Record the declined ones for the PR body.
- [x] T040 [US4] Delete `mission/` with `git rm -r mission`. It holds the 9 lessons merged in
      T031–T037 and the 2 proposals: one filed in T038, one declined. This depends on
      T031–T039.
- [x] T041 [US4] Run all of [quickstart.md](quickstart.md) checks 1 and 5 and the Prettier check.
      Open PR `docs/drain-mission-queues` after the user confirms. The body lists:
  - each of the 9 lessons with its outcome and target;
  - both proposals with their outcomes (filed with its issue number, or declined);
  - the follow-up issues filed or declined.

**Checkpoint**: US1, US2 and US4 are complete, and `mission/` is gone.

---

## Phase 6: User Story 3 — Definition of Done reflects the constitution (P3)

**Goal**: The DoD carries the constitution's per-change obligations, and done means deployed
and observed (FR-007, and FR-020's done half).

**Independent test**: compare AGENTS.md's Definition of Done against C3–C6. Every per-change
obligation is present or linked by rule id. It says done means deployed and the production
signal checked, and it names who confirms correctness.

**PR**: `docs/definition-of-done`

- [x] T042 [US3] Edit the `AGENTS.md` Definition of Done. Add these items, citing the rule id
      for each and not paraphrasing:
  - a bug fix starts with a failing reproduction test (C3);
  - any new repeatable command is added to `services.yaml` and CI invokes it (C4);
  - the plan states how the change is reverted, and that takes under 5 minutes (C5);
  - the change is deployed and its named production signal has been checked, and merging
    alone isn't done (C6);
  - correctness is confirmed by `/speckit-analyze`, `/speckit-converge` and a PR review
    against the spec, never by the implementer alone.
- [x] T043 [US3] Check the US3 acceptance scenarios against the edited DoD, and run the Prettier
      check. Open PR `docs/definition-of-done` after the user confirms. Its body carries the
      follow-up list from research R6, R7 and R10:
  - stale facts outside rewritten passages (`navy`/`teal`→`amber` in AGENTS.md, the DR
    `curl /api/health` in the instance sheet, "Merge to `main`" in `sop/db-change.md`, any
    remaining `.js` paths);
  - the untouched migration docstring;
  - the `mission/` CI path filters, and `specs/` and `.specify/` missing from the skip lists.

**Checkpoint**: all user stories are complete.

---

## Phase 7: Polish and cross-cutting

- [ ] T044 Once all six PRs (T002, T013, T017, T030, T041, T043) are merged, run every check in
      [quickstart.md](quickstart.md) against `origin/main`. Confirm SC-001 to SC-007.
- [ ] T045 In a fresh session with no conversation context, do the
      [quickstart.md](quickstart.md) check 8 cold read from `CLAUDE.md`. Fix any dead end it
      finds in a follow-up PR. The feature is done when T044 and T045 pass on `main`. That is
      this docs change's version of "deployed and observed" (plan, C6).

---

## Dependencies and execution order

- **T001** (baseline) comes first, then **T002** (foundation PR). Every story depends on T002,
  because the constitution has to be on the base.
- **US1** (T003–T013), then **US2** (T014–T017), then **US4 workflow** (T018–T030), then **US4
  drain** (T031–T041), then **US3** (T042–T043), then **Polish** (T044–T045).
- Why this order, given the shared files:
  - `AGENTS.md` is edited by T009, T015, T021, T034 and T042.
  - `frontend-react.md` by T005 and T031.
  - `migrations.md` by T008 and T036.
  - `backend-fastapi.md` by T006 and T032.
  - `database-integration.md` by T007 and T025.
  - `docs/best-practices/README.md` by T016, T024 and T035.
  - `issue-tracker.md` by T022 and T037.
  - `local-testing.md` by T023 and T033.
  - `README.md` by T010 and T029.
- Story independence:
  - US1, US2 and US3 each touch passages that no other story touches, so in principle they
    could merge in any order.
  - The fixed order exists only so each PR is cut from a base that already has the earlier
    edits, which avoids rebase conflicts.
  - The US4 drain PR genuinely depends on the US4 workflow PR (T023, T024 and T019 define
    where lessons go).
- Within a story, the [P] tasks touch different files and can run concurrently. The opening
  check and the closing verify-and-open-PR task are sequential.

## Parallel examples

```text
US1, after T003:  T004 solid-principles · T005 frontend-react · T006 backend-fastapi ·
                  T007 database-integration · T008 migrations · T009 AGENTS · T010 README ·
                  T011 architecture · T012 sop/db-change
US2:              T014 CLAUDE · T015 AGENTS · T016 best-practices README
US4 workflow:     T019 methodology · T020 CLAUDE · T021 AGENTS · T022 issue-tracker ·
                  T023 local-testing · T024 bp README · T025 database-integration ·
                  T026 services.yaml · T027 instance sheet · T028 ADR · T029 README
US4 drain:        T031–T037 (seven different files), then T038 → T039 → T040 in sequence
```

## Implementation strategy

- **MVP**: T001–T013. Once US1 merges, no doc steers anyone into a constitution violation, and
  that is the highest-value slice.
- **Incremental**: each later phase is one reviewable PR. Stopping after any phase leaves the
  docs consistent. The one exception is the US4 workflow PR without the drain PR, which leaves
  `mission/lessons` and `mission/proposals` in place with a methodology that no longer
  describes them. Land the drain PR promptly after it.
- **Revert**: each PR is undone with `git revert <merge>`, which takes under 5 minutes (C5).
  If the drain PR is reverted, close its filed issues by hand.

---

## Phase 8: Convergence

- [x] T046 In `CLAUDE.md` golden rule 1 and `AGENTS.md`'s TDD section and Definition of Done,
      replace the restated correctness gates, small-bug-fix review and docs-only exception
      with "done per C6" and a link to `methodology.md` per FR-020, FR-025 (contradicts)
- [x] T047 Move "push to `develop` only to put a change on staging (UAT)" from `README.md`
      ("Shipping updates") into `AGENTS.md` ("Version control"), and replace the branch-to-app
      restatements in `README.md` ("Staging / UAT environment") and `docs/architecture.md`
      ("Production", "Deploy") with links to the README deployment table per FR-021, FR-025
      (contradicts)
- [x] T048 Replace `CLAUDE.md`'s copy of the precedence paragraph with a link to the
      constitution and to `AGENTS.md`'s statement per FR-004, FR-025 (contradicts)
- [x] T049 Replace the restated lessons-and-proposals homes in `AGENTS.md` (TDD section) and
      `CLAUDE.md` ("How work is organized") with a link to `methodology.md` per FR-018, FR-025
      (contradicts)
- [x] T050 Replace the restated living-specs rule (`CLAUDE.md` `spec.md` bullet, `AGENTS.md`
      Definition of Done) and small-bug-fix path (`CLAUDE.md` "How work is organized") with
      links to `methodology.md` per FR-023, FR-022, FR-025 (contradicts)
- [x] T051 In `AGENTS.md`'s Definition of Done, cite C3 and C5 by id without restating their
      conditions or the five-minute threshold per FR-006, FR-007 (partial)
- [x] T052 In `AGENTS.md` ("Version control"), point the specified-feature branch naming at
      Spec Kit's `/speckit-specify` step instead of `methodology.md`, which doesn't describe it,
      per FR-024 (partial)
- [x] T053 Update `contracts/precedence-statement.md` and [quickstart.md](quickstart.md)
      check 3 so the precedence statement is expected only in `AGENTS.md`, with `CLAUDE.md`
      linking to it, per FR-004 (contradicts)
- [x] T054 Add a [quickstart.md](quickstart.md) check that greps the in-scope docs for each
      owned fact (PR target, `develop` push rule, branch-to-app mapping, docs-only done,
      small bug fix, living specs, lessons and proposals, precedence, C5 threshold) and
      expects its conditions only in the owner per SC-008 (missing)
- [x] T055 Run quickstart checks 2, 3 and the new SC-008 check plus
      `npm run format:prettier:check`, and do a cold read from `CLAUDE.md` confirming every
      replaced restatement is still reachable in one link per SC-008, US2/AC1, US3/AC3
      (missing)
