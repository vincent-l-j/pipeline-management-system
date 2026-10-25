# Feature Specification: Align Contributor Docs with the Constitution

**Feature Branch**: `chore/specify`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "correct the docs to match the constitution"

## User Scenarios & Testing _(mandatory)_

The "users" of this feature are the people and AI agents who contribute to Rozetta PMS. They
learn how to work in the repo from the contributor guidance (the root guide, the agent
conventions, the architecture overview, the best-practices docs and the README). The
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
2. **Given** the Definition of Done says a feature is done at merge time, **When** it is
   compared with C6, **Then** the gap between "merged" and "shipped" is either closed in
   the wording or stated explicitly.

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
- **Files this feature may not edit** (the methodology document and the mission contract
  assertions). Conflicts found there are reported, not fixed.
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
- **FR-008**: This feature MUST NOT change the constitution, the methodology document, the
  mission contract assertions, or any application code or tests.
- **FR-009**: Conflicts found in documents this feature may not edit, and any case where a
  doc appears more correct than the constitution, MUST be recorded as proposals for
  follow-up rather than fixed in place.
- **FR-010**: The change MUST pass the repository's existing formatting check for
  documentation.

### Key Entities

- **Constitution rule**: an id (C1–C6, A4–A7, A16–A22), a Rule, a How To Apply, and an
  optional list of grandfathered exceptions. The fixed reference every doc is measured
  against.
- **In-scope document**: a contributor-facing guidance file that may be edited (see
  Assumptions).
- **Conflict**: a passage in an in-scope document plus the rule it contradicts. It's
  resolved by rewriting, by adding a grandfathered label, or by deferring to the rule by id.
- **Proposal**: a recorded follow-up for a conflict this feature may not fix in place.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A rule-by-rule review of every in-scope document finds 0 passages that
  recommend a forbidden or grandfathered pattern for new work (the baseline has at least 8,
  per the inventory below).
- **SC-002**: 100% of the conflicts in the inventory below are resolved or recorded as
  proposals.
- **SC-003**: A reader starting from the root contributor guide reaches the constitution in
  one link.
- **SC-004**: Every mention of a grandfathered pattern in the in-scope documents carries its
  rule id.
- **SC-005**: The change touches only documentation files, and the documentation formatting
  check passes.

## Assumptions

- **Direction of correction**: the constitution is authoritative and the docs move to
  match it. Amending the constitution is out of scope (it has its own governance).
- **In scope**: `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/architecture.md`,
  `docs/best-practices/*`, and `docs/agents/*`. **Out of scope**: `methodology.md` and
  `mission/contract/` (off-limits per the repo boundaries), `.specify/` templates, the
  constitution itself, existing ADRs (they're historical records), and `sop/` runbooks
  unless the sweep finds a direct conflict there.
- **Docs only**: grandfathered debt in code stays in place. This feature labels it and does
  not pay it down.
- **One PR or several**: the work can land as one docs PR or be split by document, following
  the repo's small-commit convention. Either way it's revertible by a plain revert, which
  takes under five minutes (C5). Its production signal (C6) doesn't apply because no
  runtime behaviour changes.
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
- **Activity rules with no current doc conflict** (A4, A6, A7, A16–A22) are checked by the
  sweep, but new guidance isn't written for them. The constitution already states them, and
  the governance section keeps principles out of the other docs.
