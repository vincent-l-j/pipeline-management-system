# Feature Specification: Align Contributor Docs with the Constitution

**Feature Branch**: `001-align-docs-constitution`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "correct the docs to match the constitution"

## Clarifications

### Session 2026-10-26

- User direction (with the `/speckit-clarify` request): `methodology.md` and the ADRs are in
  scope. Grandfathered application code stays as tech debt to pay down later. The
  `mission/contract/` assertions have been deleted as outdated, and `mission/features/` is
  empty, so the old contract and feature queue no longer exist.
- Q: Now that Spec Kit (`specs/` plus the constitution) is how features get specified, what
  should happen to the mission workflow that `methodology.md` describes? → A: Rewrite
  `methodology.md` around the Spec Kit workflow. Keep the principles that still hold (queues
  drain rather than grow, lessons get promoted into best-practices, rules graduate into
  tooling, ids are local to their queue). Drop the parts that only applied to the old
  workflow: the orchestrator/runner, the validation contract, feature JSON files, missions
  running directly on `main`, and the runner's pre-integration checks.
- Q: Where should lessons (rules learned from defects) and proposals (ideas for automated
  checks) live once the mission workflow is gone? → A: Drain both now and delete `mission/`.
  The existing lessons are merged into best-practices (one-offs and already-enforced ones
  are deleted), and the existing proposals become GitHub issues. From now on, a lesson is
  written straight into best-practices in the PR that fixes the defect, and a proposal is
  filed as a GitHub issue for triage. No holding queue remains.
- User direction (2026-10-26, after planning): don't file the queue-id grep proposal. It is
  declined: the contract is gone, so no new assertion ids can appear and the check would
  guard nothing. Its file is deleted without an issue.
- Q: ADR 0002 gives the now-deleted contract's assertions as its deciding factor. How should
  ADRs that cite retired artifacts be corrected? → A: Append-only. Keep the decision and its
  original reasoning, and add a short dated note under it saying the cited contract was
  retired, the decision still stands, and what guards the behaviour now. The same applies
  to an ADR found to conflict with the constitution: a note or an amendment candidate, never
  a silent edit.
- Q: With the contract gone, what decides that a change is correct and done? → A: The spec's
  acceptance scenarios define "correct". `/speckit-analyze` and `/speckit-converge` act as
  gates, and a PR reviewer (human or agent) judges the change against the spec and cites
  constitution rules by id. The implementer never signs off on their own work. Done means
  deployed and observed (C6), not merged.

## User Scenarios & Testing _(mandatory)_

The "users" of this feature are the people and AI agents who contribute to Rozetta PMS. They
learn how to work in the repo from the contributor guidance (the root guide, the agent
conventions, the workflow methodology, the architecture overview, the best-practices docs,
the ADRs and the README). The
constitution, ratified on 2026-10-23 at v1.0.0, is now the top-level authority on principles,
but none of that guidance mentions it, and some of it tells contributors to do things the
constitution forbids or only tolerates as grandfathered debt.

### User Story 1 - Guidance never instructs a constitution violation (Priority: P1)

A contributor follows a best-practices doc step by step: for example, how to test a component,
how to design a page's states, or when to extract a service. Whatever they produce must pass
the constitution check at plan and review time. No doc should present a grandfathered pattern
as the recommended way, or set a threshold that contradicts a rule.

**Why this priority**: Contradictory guidance is the costliest kind of drift. Each contributor
who follows it creates new violations that reviewers then have to reject, and each violation
gets copied as a precedent.

**Independent Test**: Take each constitution rule's Rule and How To Apply text and search the
guidance for statements that contradict it. Every contradiction found today (see the
inventory under Assumptions) is resolved, and a reviewer re-running the sweep finds none.

**Acceptance Scenarios**:

1. **Given** the frontend testing guidance, **When** a contributor reads how to isolate a
   component from the network, **Then** it presents mocking the project's own HTTP client as
   grandfathered debt that needs a recorded exception, not as the default, consistent with C3.
2. **Given** the guidance on page states, **When** a contributor designs a data-fetching view,
   **Then** it requires the four states (loading, error, empty, loaded), a timeout on any
   request that can hang, and a retry path from the error state, consistent with A5.
3. **Given** the design-principles guidance, **When** a contributor decides whether to
   extract a service, base class, shared hook or interface, **Then** the threshold is three
   existing call sites (C1), not "a second consumer". A route growing logic no longer means
   "push it into a service" by default.
4. **Given** the guidance's account of why dependencies are injected, **When** a contributor
   reads it, **Then** it matches C2 and C3: it does not claim the suite overrides dependencies
   to avoid running on the real database, and it calls the existing self-dependency overrides
   grandfathered.

---

### User Story 2 - Contributors can find the constitution and know how it relates to other docs (Priority: P2)

A new contributor or agent opens the root guide or the agent conventions. They learn that a
constitution exists, where it lives, that it outranks the other guidance on principles, and
that tool names, versions, style and workflow live in the other docs (as the constitution's
own governance section says).

**Why this priority**: A constitution nobody is pointed at can't shape plans written outside
the Spec Kit commands. This is a pointer, not new content, so it's cheap once User Story 1
has made the docs consistent.

**Independent Test**: Starting from the root guide alone, a reader reaches the constitution
in one hop and can say which document wins when principles conflict.

**Acceptance Scenarios**:

1. **Given** the root contributor guide, **When** a reader looks for project principles,
   **Then** it links to the constitution and says the constitution governs principles.
2. **Given** the best-practices index's rules for keeping docs in sync, **When** a doc and
   the constitution disagree on a principle, **Then** the index says the doc is corrected
   (or a constitution amendment is proposed) and the conflict isn't left standing.
3. **Given** any guidance that restates a constitution rule, **When** it is read, **Then** it
   points to the rule by id (e.g. "C3") instead of carrying a paraphrase that can drift.

---

### User Story 3 - Definition of Done and plan expectations reflect the constitution (Priority: P3)

A contributor checks the Definition of Done and version-control guidance before opening a PR.
Those checklists include what the constitution makes mandatory: how the change is reverted
and how long that takes (C5), how the change is observed in production (C6), any new
repeatable command added to the one command registry that CI also uses (C4), and a failing
reproduction test first for bug fixes (C3).

**Why this priority**: These items already reach contributors through the plan template's
Constitution Check. Duplicating them in the checklists adds reinforcement but doesn't unblock
anything.

**Independent Test**: Compare the Definition of Done with C3 to C6. Every mandatory
per-change obligation appears there or is linked by rule id.

**Acceptance Scenarios**:

1. **Given** the Definition of Done, **When** a contributor completes a feature, **Then** it
   asks for a stated revert path and a production observation signal, or points to the
   constitution rules that require them.
2. **Given** the Definition of Done, **When** it is compared with C6, **Then** it says a
   change is done once deployed and its production signal has been checked, not at merge.
3. **Given** the Definition of Done, **When** a contributor asks who confirms the change is
   correct, **Then** it names the spec's acceptance scenarios as the measure, the
   `/speckit-analyze` and `/speckit-converge` gates, and a PR review against the spec and
   constitution. The implementer's own judgement is never enough.

---

### User Story 4 - The workflow docs describe the workflow the repo actually uses (Priority: P2)

A contributor or agent who wants to know how work moves from idea to production reads the
methodology and the root guide. What they find is the Spec Kit flow: constitution, then
specify, clarify, plan, checklist, tasks, analyze, implement, converge. They also find the
lasting practices the old mission workflow contributed, such as draining lessons into
best-practices and graduating rules into tooling. Nothing sends them to a validation
contract, feature queue or runner that no longer exists.

**Why this priority**: The contract is deleted and the feature queue is empty. Any doc that
still routes work through them gives instructions that can't be followed, and an agent
following them will either stall or recreate the deleted artifacts.

**Independent Test**: Follow every workflow instruction in the root guide, the agent
conventions, the methodology and the issue-tracker guide from a fresh checkout. Every
artifact they name exists, or is created by a Spec Kit command they name.

**Acceptance Scenarios**:

1. **Given** the rewritten methodology, **When** a reader looks for how a feature is
   specified and built, **Then** it describes the Spec Kit steps and the `specs/<feature>/`
   artifacts, and it doesn't mention an orchestrator, runner, validation contract or
   feature JSON queue as current practice.
2. **Given** the rewritten methodology, **When** a reader looks for how defects become
   rules, **Then** the lesson-to-best-practices promotion and the rule-to-tooling ladder are
   still described, including the admission bar for automated checks.
3. **Given** the methodology's branch model, **When** it is compared with the agent
   conventions' version-control section and C6, **Then** they agree: a branch and PR per
   change, and done means deployed and observed, not merged.
4. **Given** any in-scope document, **When** it is searched for references to the deleted
   contract or the feature queue, **Then** none describes them as live.
5. **Given** a contributor who has just fixed a defect, **When** they look up what to do
   with the lesson, **Then** the methodology tells them to merge it into best-practices in
   the same PR, preferring an existing rule over a new one, and to file any idea for an
   automated check as a GitHub issue.
6. **Given** the repository after this feature lands, **When** a reader looks for
   `mission/`, **Then** it doesn't exist, and every lesson that was in it is either present
   as a best-practices rule or was deliberately dropped as a one-off or already enforced.

---

### Edge Cases

- **Grandfathered patterns that the docs describe accurately.** The docs must keep
  describing how existing code works (for example, how the current tests mock the HTTP
  client). Accurate description stays; it gains a "grandfathered under <rule id>" label, and
  any wording that recommends the pattern for new code is removed.
- **Guidance that is right but weaker than the rule** (for example, "prefer expand/contract"
  against C5's "migrations are expand-then-contract"). It's strengthened to match the rule,
  or it defers to the rule by id.
- **A doc that seems more correct than the constitution.** The doc isn't silently kept in
  conflict, and the constitution isn't edited as part of this feature. The disagreement goes
  in as a proposal for a separate amendment PR, per the constitution's governance, and the
  doc defers to the current rule until then.
- **The constitution itself** is the only guidance file this feature may not edit. Conflicts
  that seem to call for changing it are reported, not fixed.
- **Durable references to the deleted contract** (for example, a test-coverage note that
  names an assertion id). The reference is reworded to describe the behaviour or the test
  that now guards it, never left pointing at a file that no longer exists.
- **An ADR that cites a retired artifact or conflicts with the constitution** keeps its
  original text. A dated note is appended below it; the decision and reasoning above the
  note are not edited.
- **A lesson that duplicates an existing rule or is already enforced by a test or linter**
  is deleted rather than promoted. One that duplicates a constitution rule is dropped in
  favour of the rule id, because principles don't get restated in best-practices.
- **A lesson that conflicts with the constitution** is not promoted as written. It is
  reworded to comply, or recorded as an amendment candidate.
- **CI path filters that name `mission/`** become dead patterns once the folder is gone.
  They're harmless and live in deploy configuration, so they're left for a separate change
  rather than touching the deploy path in a docs feature (C5).
- **Stale facts found during the sweep** that have nothing to do with the constitution (for
  example, a doc that names a file by an old extension). They're fixed only where they sit
  inside a passage that is being rewritten anyway. Otherwise they're left for a separate
  change, to keep this one single-concern.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: No in-scope document may recommend, as the default for new work, a pattern
  that the constitution forbids or lists as grandfathered.
- **FR-002**: Every in-scope passage that describes a grandfathered pattern MUST name the
  rule it is grandfathered under, by id.
- **FR-003**: Thresholds and obligations in in-scope documents MUST NOT contradict the
  constitution. That covers the abstraction-extraction threshold (C1), the required view
  states, timeout and retry (A5), migration shape (C5), and test doubles for owned code (C3).
- **FR-004**: The root contributor guide and the agent conventions MUST link to the
  constitution, say that it governs principles, and say that tooling, versions, style and
  workflow stay in the existing docs.
- **FR-005**: The best-practices index's doc-sync rules MUST say what happens when a doc
  conflicts with the constitution: the doc is corrected, or an amendment is proposed.
- **FR-006**: Where in-scope guidance would otherwise restate a constitution rule, it MUST
  refer to the rule by id rather than paraphrasing it.
- **FR-007**: The Definition of Done MUST include, or link by rule id, the constitution's
  per-change obligations: revert path (C5), production observation (C6), single command
  registry (C4), and a failing reproduction test for bug fixes (C3).
- **FR-008**: This feature MUST NOT change the constitution or any application code or
  tests. Grandfathered code stays as tech debt.
- **FR-009**: Any case where a doc appears more correct than the constitution MUST be
  filed as a GitHub issue (an amendment candidate) rather than fixed by editing the
  constitution.
- **FR-010**: The change MUST pass the repository's existing formatting check for
  documentation.
- **FR-011**: `methodology.md` MUST describe the Spec Kit workflow as the way features are
  specified, planned and built. It MUST keep the drain-not-grow principle, the
  lesson-to-best-practices promotion, the rule-to-tooling ladder with its admission bar,
  and the rule that durable files never cite ids of things that get deleted. It MUST drop
  the orchestrator/runner, validation contract, feature JSON queue, lesson and proposal
  queues, milestone consolidation pass, missions-on-`main` branch model and runner
  pre-integration checks.
- **FR-012**: No in-scope document may describe the deleted validation contract or the
  feature queue as live. Every instruction that routed work through them MUST be replaced
  by the matching Spec Kit step, or removed.
- **FR-013**: The branch and review model in `methodology.md` MUST agree with the agent
  conventions' version-control section and with C6.
- **FR-014**: Every link in an in-scope document MUST resolve to a file that exists.
- **FR-015**: Each existing lesson MUST end in one of three ways: merged into a
  best-practices rule (preferring an existing rule), dropped in favour of a constitution
  rule id, or deleted as a one-off or already enforced. The outcome for each MUST be stated
  in the PR description.
- **FR-016**: The assertion-target lint proposal MUST be filed as a GitHub issue that
  carries its enforced rule, evidence, approach, cost and confidence. The queue-id grep
  proposal is declined, and no issue is filed for it. Both proposal files are then deleted,
  and the PR description states each outcome.
- **FR-017**: After FR-015 and FR-016, `mission/` MUST be deleted, and no in-scope document
  may refer to it or its subfolders as a place to put work.
- **FR-018**: The methodology and the agent conventions MUST state the new homes: lessons
  go into best-practices in the PR that fixes the defect, and proposals for automated
  checks go to the GitHub issue tracker.
- **FR-019**: ADRs MUST be corrected only by appending a dated note below the original
  text. The note says what changed (for example, the cited contract was retired), whether
  the decision still stands, and what now guards the behaviour. Text above the note MUST
  NOT be changed.
- **FR-020**: The root guide's golden rules, the agent conventions' TDD section and
  Definition of Done, and the methodology MUST say that correctness is judged against the
  feature spec's acceptance scenarios, through the `/speckit-analyze` and
  `/speckit-converge` gates and a PR review that cites constitution rules by id, never by
  the implementer alone. They MUST say that done means deployed and observed (C6). No
  in-scope document may name an independent validator judging against a validation
  contract as the arbiter.

### Key Entities

- **Constitution rule**: an id (C1–C6, A4–A7, A16–A22), a Rule, a How To Apply, and an
  optional list of grandfathered exceptions. The fixed reference every doc is measured
  against.
- **In-scope document**: a contributor-facing guidance file that may be edited (see
  Assumptions).
- **Conflict**: a passage in an in-scope document plus the rule it contradicts. It's
  resolved by rewriting, by adding a grandfathered label, or by deferring to the rule by id.
- **Amendment candidate**: a GitHub issue recording a case where a doc seems more correct
  than the constitution, for a separate amendment PR.
- **Lesson**: what broke, its root cause and the rule that would have prevented it. Its
  only durable home is a best-practices rule; it has no holding queue.
- **Proposal**: an idea for an automated check, with the rule it enforces, evidence,
  approach, cost and confidence. Its home is a GitHub issue, triaged to accept or decline.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A rule-by-rule review of every in-scope document finds 0 passages that
  recommend a forbidden or grandfathered pattern for new work (the inventory below lists
  the baseline).
- **SC-002**: 100% of the conflicts in the inventory below are resolved, or filed as
  amendment candidates.
- **SC-003**: A reader starting from the root contributor guide reaches the constitution in
  one link.
- **SC-004**: Every mention of a grandfathered pattern in the in-scope documents carries its
  rule id.
- **SC-005**: Each of the five story PRs touches only documentation files (Markdown,
  comment-only `services.yaml` edits, and deletions under `mission/`), and the documentation
  formatting check passes. The foundation PR that lands the Spec Kit setup is outside this
  criterion.
- **SC-006**: Searching the in-scope documents for the validation contract, the feature
  queue, the runner and assertion ids finds 0 references that present them as current.
- **SC-007**: `mission/` no longer exists, all 9 existing lessons have a stated outcome,
  the assertion-target lint
  proposal is an open GitHub issue, and the declined queue-id grep proposal has none.

## Assumptions

- **Direction of correction**: the constitution is authoritative and the docs move to
  match it. Amending the constitution is out of scope (it has its own governance).
- **In scope**: `CLAUDE.md`, `AGENTS.md`, `README.md`, `methodology.md`,
  `docs/architecture.md`, `docs/adr/*`, `docs/best-practices/*`, `docs/agents/*`, the
  comments in `services.yaml`, and `sop/` wherever it references the contract or conflicts
  with a rule. **Out of scope**: `.specify/` templates, the constitution itself, and
  comments or docstrings in application code and tests.
- **Filing GitHub issues** is outward-facing, so the issues for proposals and amendment
  candidates are created during implementation after the user confirms them.
- **Docs only**: grandfathered debt in code stays in place as tech debt to pay down later.
  This feature labels it in the docs and does not pay it down.
- **One PR or several**: the work can land as one docs PR or be split by document, following
  the repo's small-commit convention. Either way it's revertible by a plain revert, which
  takes under five minutes (C5). No runtime behaviour changes, so C6's "observed" means the
  quickstart checks pass on `main` and a fresh session's cold read finds no dead ends (see
  plan.md, Constitution Check).
- **Baseline inventory of conflicts** found during specification. This is not exhaustive;
  the plan's sweep confirms and extends it.
  1. Design-principles doc: "push that into a service" and "reach for a new abstraction when
     a second … consumer appears", against C1's three-call-site threshold. Its Open/Closed
     framing ("open for extension") reads against C1's title.
  2. Design-principles doc, DIP section: says dependency overrides let the suite run
     "without Postgres or real tokens", which is stale and conflicts with C3. It doesn't
     label self-dependency overrides as grandfathered. It calls reading env vars directly a
     smell but praises the notetaker, which C2 grandfathers for exactly that.
  3. Agent conventions, TDD section: "mock `src/services/api`" as the default, against C3.
  4. Frontend guide: "mock the network by mocking `src/services/api`" and a checklist item
     "`api` mocked", against C3.
  5. Database-integration guide: "Frontend: mock `services/api`", against C3.
  6. Frontend guide: "three UI states: loading, empty, and error", with no timeout or retry,
     against A5's four states plus timeout and retry.
  7. Migrations guide: "prefer expand/contract", weaker than C5.
  8. Agent conventions, Definition of Done: no revert statement (C5), no production
     observation (C6), and done at merge, against C6.
  9. No in-scope document mentions the constitution or the order of precedence.
  10. Methodology: "worktrees don't push branches and don't open pull requests" and
      "missions run on `main`", against the agent conventions' branch and PR per change and
      against C6.
  11. Root guide, agent conventions, issue-tracker guide, best-practices index,
      database-integration guide, `services.yaml` comments and the instance sheet under
      `sop/` all still treat the deleted contract or the feature queue as live, or cite
      assertion ids.
  12. Methodology links to `AGENT-READINESS.md`, which doesn't exist.
  13. ADR 0002 justifies its decision by the assertions in the now-deleted contract.
- **Activity rules with no current doc conflict** (A4, A6, A7, A16–A22) are checked by the
  sweep, but new guidance isn't written for them. The constitution already states them, and
  the governance section keeps principles out of the other docs.
