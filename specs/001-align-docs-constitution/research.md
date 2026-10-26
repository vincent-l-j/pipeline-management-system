# Research: Align Contributor Docs with the Constitution

Phase 0 output for [plan.md](plan.md). Each section records a decision, why it was made, and
what else was considered. Three read-only sweeps produced the findings:

1. Every in-scope doc checked rule by rule against the constitution.
2. Every reference to the retired mission workflow, plus which tests now guard each deleted
   assertion.
3. A triage of each lesson and proposal.

Line numbers are as of commit `d5c96f2` and only help locate a passage. Implementers search by
the quoted text.

## R1. Shape of the rewritten `methodology.md`

**Decision**: Rewrite it as a short document on how this repo works with Spec Kit, using the
outline in [contracts/methodology-outline.md](contracts/methodology-outline.md).

- **Kept**, reworded for a world without a runner:
  - separation of concerns between implementer and reviewer, with no self-validation;
  - TDD;
  - drain, don't grow;
  - learning from defects;
  - rules graduate into tooling, with the full admission bar and the "what automates well"
    section;
  - durable files never cite ephemeral ids.
- **Dropped**:
  - the orchestrator, workers and validators as runner roles;
  - the runner itself, milestones, worktree integration and linear rebase;
  - the queue table;
  - the contract, feature JSON, lesson and proposal artifacts;
  - "Ids are queue-local" as written, "Missions run on `main`", interrupts and
    `~/.missions` state;
  - the pre-integration checks.
- **The `AGENT-READINESS.md` link** is removed.
- **Branch flow** is not restated. The doc points to the version-control section of
  `AGENTS.md`.

**Rationale**: The rule-to-tooling ladder and the admission bar aren't in Spec Kit or the
constitution, and both are still the right way to grow checks (FR-011). The runner material
describes machinery that no longer exists. On branch flow, `AGENTS.md` says to branch off
`main`, while `README.md` describes `develop`, then `main`. Today `origin/develop` and
`origin/main` point at the same commit, so restating either flow risks a third version. A
pointer satisfies FR-013.

**Alternatives considered**: Deleting the file was rejected at clarification (Q1). Keeping
the runner sections as "optional" was rejected because a second workflow is a second source
of truth.

## R2. Outcome for each lesson (FR-015)

**Decision**: Merge or add all nine. None is a one-off, already enforced, or a restatement of
a constitution rule, and none conflicts with the constitution.

| Lesson                                         | Outcome | Target                                                                                                                                                                  |
| ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A removal leaves no test behind                | Add     | `docs/best-practices/frontend-react.md` testing guidelines, with a one-line pointer from `backend-fastapi.md` testing                                                   |
| A shadowed port serves a different environment | Merge   | `docs/agents/local-testing.md`, "The address" section: name the process that answered (`ss -ltnp`, `/proc/<pid>/environ`)                                               |
| Branch off the fetched target                  | Merge   | `AGENTS.md` version control, "Start clean": fetch, cut from `origin/<base>`, and check ancestry before stacking                                                         |
| Docs cannot cite a sibling branch              | Merge   | `docs/best-practices/README.md` rule 4 (forward references). Also replace its stale "queued feature" example                                                            |
| Fixtures smaller than production hide overflow | Merge   | `frontend-react.md`, "Give a layout fixture more than one row": size the fixture from the endpoint's bound, and `min-w-0` on shrinking flex items                       |
| Memoize effect handlers                        | Add     | `frontend-react.md` components section. Also file an issue proposing `eslint-plugin-react-hooks` (it would move the rule up to tooling)                                 |
| Pin migration tests to revisions               | Merge   | `docs/best-practices/migrations.md` Level 2. Rewrite steps 3–4, which currently prescribe the floating `upgrade head` / `downgrade -1` pattern the lesson warns against |
| Search the tracker before filing               | Merge   | `docs/agents/issue-tracker.md` conventions, "Create an issue": search `--state all` first, and comment on the existing issue rather than filing a duplicate             |
| Test the behaviour, not the content            | Merge   | `frontend-react.md`, next to "assert on what the component rendered, not what the test arranged"                                                                        |

The draft text for each rule is the lesson's own `Rule:` line, cut to one to three sentences
of self-contained prose. Each lesson file holds the draft, so it isn't copied here; the
implementer reads the file and then deletes it.

**Rationale**: Each lesson fills a gap the sweep confirmed. The migrations lesson also exposes
a passage that contradicts the existing tests (`backend/tests/migrations/` already pins
revisions).

**Alternatives considered**: Dropping "memoize effect handlers" in favour of a lint rule now
was rejected. Adding a dependency and its CI wiring is code work outside FR-008. The issue
captures it.

## R3. Proposals become GitHub issues (FR-016)

**Decision**: File one issue, labelled `needs-triage` from `docs/agents/triage-labels.md`,
and decline the other.
Draft bodies are in [contracts/issue-drafts.md](contracts/issue-drafts.md).

- **Assertion-target lint.** The body is reworded so it no longer cites "this mission's
  contract failure". The proposal's own author leaned towards declining it, and the issue
  says so.
- **Queue-id grep.** Declined by the user, and no issue is filed. Once this feature removes
  the last `VAL-` id (in `services.yaml`), no new ids can appear, because the contract is
  gone. The file is deleted, and the PR body records it as declined.

`gh` is authenticated as `vincent-l-j`. Each issue still needs the user's confirmation,
because filing is outward-facing.

**Alternatives considered**: Deciding the proposals inline (accept or decline) was rejected.
Clarification Q2 routed them to triage.

## R4. Constitution conformance edits, by file (FR-001, 002, 003, 006)

**Decision**: Resolve each finding in one of three ways:

- **Rewrite**: the passage recommends a forbidden pattern, or contradicts a rule.
- **Label**: add "grandfathered under Cn" where the passage describes existing code accurately.
- **Point**: replace a paraphrase of a principle with its rule id.

| File                                          | Rewrite                                                                                                                                                                                                                                                                                           | Label                                                                                                                                             | Point                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `docs/best-practices/solid-principles.md`     | SRP's "push that into a service" becomes "inline until three call sites" (C1). The closing "second reason, consumer" becomes three (C1). DIP's "run without Postgres" is removed: the suite runs on Postgres. OCP is reframed so it serves deletion (C1 title).                                   | Auth fixtures and `dependency_overrides` (C3). Notetaker env read and inline client (C2), which is no longer held up as a DIP exemplar.           | Opening line: SOLID explains the conventions, and the constitution governs.                                          |
| `docs/best-practices/frontend-react.md`       | "Three UI states" becomes four states plus timeout plus retry, with the example updated (A5). Checklist "`api` mocked" becomes "no own-code mock without a recorded exception" (C3). "Mocked `useAuth`" becomes a real `AuthProvider` with seeded storage; this pattern isn't grandfathered (C3). | "Mock the network by mocking `src/services/api`" is grandfathered (C3). The mutable request-id module state in `api.ts` (C2).                     | A4 native controls; A6 dependency size cost; A7 URL and server state, one line each where the topic already appears. |
| `docs/best-practices/backend-fastapi.md`      | "Reusable logic in `services/`" becomes "a service needs three call sites" (C1). "Never f-string caller-supplied data" widens to all variable data as named fields (A21). The testing section and checklist add a failing repro test first for bug fixes (C3).                                    | Module-level settings (C2). `setup_logging()` at import (C2). The `get_current_user`-overriding fixtures (C3). The notetaker (C2, A16, A17, A19). | A21 on the request-id and acting-user section; A22 on probes at DEBUG.                                               |
| `docs/best-practices/database-integration.md` | "Mock `services/api`" is grandfathered (C3) rather than recommended. "The contract's `VAL-*` assertions are verified black-box" becomes the spec's acceptance scenarios verified on the running stack.                                                                                            | The mock-payload drift pitfall is framed as a cost of the grandfathered pattern.                                                                  | —                                                                                                                    |
| `docs/best-practices/migrations.md`           | "Prefer expand/contract" becomes "migrations are expand-then-contract (C5)". A lossy downgrade names its restore path and revert time (C5). Level 2 steps are pinned (R2).                                                                                                                        | "Rollback not rehearsed during deploy" (C5).                                                                                                      | The deploy section points to C5.                                                                                     |
| `docs/best-practices/README.md`               | Add a conflict rule: a doc that disagrees with the constitution is corrected, or an amendment candidate is filed (FR-005). Remove the `mission/contract/` paragraph. "Four short docs" becomes a wording that doesn't count them (README rule 3).                                                 | —                                                                                                                                                 | —                                                                                                                    |
| `AGENTS.md`                                   | TDD: "mock `src/services/api`" is grandfathered (C3). The DoD gains a repro test, revert path, deployed-and-observed, correctness judged against spec acceptance scenarios via analyze, converge and review (FR-007, FR-020). Remove all queue, contract, validator and orchestrator wording.     | Auth fixtures (C3).                                                                                                                               | Opening: link the constitution and state precedence (FR-004). Frontend conventions: A4 and A7 pointers.              |
| `CLAUDE.md`                                   | Rewrite "How work is organized" for Spec Kit (FR-012). Golden rule 1 becomes judged against spec acceptance scenarios (FR-020). Boundaries drop queue rules. The repo map drops `mission/` and adds `specs/` and `.specify/`. Issue-tracker blurb.                                                | —                                                                                                                                                 | Precedence statement plus a link to the constitution (FR-004).                                                       |
| `README.md`, `docs/architecture.md`           | Remove the broken user-guide link (the file was deleted in an earlier cleanup).                                                                                                                                                                                                                   | CI's container `--target test` for the jsdom suite (C4). Logging configured at import (C2). Notetaker env read (C2, A16).                         | —                                                                                                                    |
| `sop/db-change.md`                            | The steps require expand-then-contract (C5). The production revert states its path and time (C5). "Done" adds the production signal checked (C6).                                                                                                                                                 | —                                                                                                                                                 | —                                                                                                                    |
| `sop/instances/rozetta-pms.md`                | Reword the `VAL-ATTACH-002` sentence (R8).                                                                                                                                                                                                                                                        | —                                                                                                                                                 | —                                                                                                                    |

**Rationale**: These three ways of resolving a finding match the spec's Conflict entity. The
pointers keep principles out of the docs, as the constitution's governance section requires.

**Alternatives considered**:

- **Shortening `CLAUDE.md`'s golden rules wholesale into rule ids** was rejected. Most of them
  are repo-specific conventions (trailing slashes, snake_case, `api.ts`), which governance
  says belong in `CLAUDE.md`. Only rule 1 changes.
- **Writing new A4, A6 and A7 guidance** was rejected per the spec's assumption. They get
  pointers only.

## R5. Gaps the docs can't close (C4 commands, A22 alerts)

**Decision**: These are out of scope. File them as follow-up conformance-gap issues after the
user confirms, and don't label them grandfathered, because the constitution doesn't
grandfather them.

- **C4.** CI runs inline commands where `services.yaml` names exist (`pytest` variants,
  `format:prettier:check`). `services.yaml` has no `migrate`, `make-migration`,
  `test-migrations` or readiness command. `README.md` and `docs/architecture.md` give raw
  `docker compose run … alembic` commands. Where a `services.yaml` name already exists, the
  docs cite it. Where none exists, the docs keep the raw command, and the issue covers adding
  the name.
- **A22.** The instance sheet's `MEM_UTILIZATION` and `RESTART_COUNT` alerts have no stated
  user-visible symptom and no runbook under `sop/`.

**Rationale**: Closing these means editing CI, `services.yaml` commands and alerting, which is
config and ops work and touches the deploy path. Under C5 that has to be gated, and under the
small-PR convention it belongs in its own change. Labelling them grandfathered would invent
exceptions the constitution doesn't contain, and amending the constitution is out of scope.

**Alternatives considered**: Adding the missing commands to `services.yaml` here was rejected
because it's a code and CI change, not documentation (SC-005).

## R6. Stale facts outside rewritten passages

**Decision**: Fix stale facts only inside passages this feature rewrites. That covers most
`.js`→`.ts` paths in `frontend-react.md` and `database-integration.md`, because those
sections are being rewritten anyway. Leave the rest in a follow-up list in the PR body:
`navy`/`teal`→`amber` in `AGENTS.md`, the `curl /api/health` in the instance sheet's DR
steps, "Merge to `main`" in `sop/db-change.md`, and any remaining `.js` paths.

**Rationale**: This is the spec's edge case, kept so the change stays single-concern.

## R7. Durable references to deleted ids and the contract

**Decision**: The contract's behaviour is described by the tests that now guard it.

| Location                              | New wording (gist)                                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services.yaml` header comment        | "Commands contributors and CI use…" in place of "validators/workers".                                                                                     |
| `services.yaml` `objectstore` comment | "Only needed to exercise them for real: upload a file and compare the stored object's checksum with the source." The `VAL-ATTACH-002` id is removed.      |
| `sop/instances/rozetta-pms.md`        | "A real Space is still the only proof that an uploaded file arrives byte-identical (compare source and stored checksums); no automated test covers that." |
| ADR 0002                              | An appended dated note; see [contracts/adr-note.md](contracts/adr-note.md).                                                                               |
| Migration `1ccc89086896` docstring    | **Not changed.** It's application code (FR-008), and migration files are immutable history. It's listed in the PR body.                                   |

Coverage found for the deleted assertions: every one has guarding tests, with two gaps. No
automated test checks a byte-identical upload against a real store; the services and SOP
wording says so. No test checks that the error-fallback reference appears in the log record
itself. That second gap is mentioned in the PR body as a candidate test, not fixed here
(FR-008).

## R8. ADR correction format (FR-019)

**Decision**: Append an `## Update YYYY-MM-DD` section below the original text, in the form
set out in [contracts/adr-note.md](contracts/adr-note.md). ADR 0001 needs no note.

## R9. Broken links (FR-014)

**Decision**:

- `methodology.md` → `AGENT-READINESS.md`: removed in the rewrite.
- `methodology.md` prose reference to `best-practices/testing.md`: removed in the rewrite.
- `README.md` → `Rozetta_PMS_User_Guide.md`: the sentence is removed. The guide was deleted in
  an earlier cleanup, and no replacement is planned.

## R10. CI path filters naming `mission/`

**Decision**: Leave them (spec edge case). Note in the PR body that `specs/` and `.specify/`
aren't in the CI and deploy skip lists either, so a spec-only change triggers a full CI run.
That's harmless and goes in the follow-up list.

## R11. How the change lands

**Decision**: One foundation PR, then five docs PRs, one per user story phase, landing in
order. [tasks.md](tasks.md) is the authority on which task lands in which PR.

0. **`chore/specify`** (foundation): the Spec Kit setup, the constitution, the contract
   deletion and this spec folder. It isn't pushed yet, and every later PR cites the
   constitution.
1. **`docs/constitution-conformance`** (US1).
2. **`docs/constitution-precedence`** (US2).
3. **`docs/spec-kit-workflow`** (US4, the workflow half).
4. **`docs/drain-mission-queues`** (US4, the lessons, proposals and `mission/` deletion). It
   needs PR 3's new destinations for lessons.
5. **`docs/definition-of-done`** (US3).

Each PR is a plain `git revert` away from undone (C5).

**Rationale**: AGENTS.md prefers small, single-concern PRs, and one PR per story keeps each
independently reviewable. The order avoids rebase conflicts on the files several stories edit.

**Alternatives considered**:

- **One PR** was rejected as too large to review.
- **One PR per file** was rejected because it splits single concerns.
- **The plan's earlier four-PR split, which grouped by file area,** was replaced so PRs line
  up with user stories.

## R12. Verification approach

**Decision**: Verify with searches and existing commands, listed in
[quickstart.md](quickstart.md). They are added to neither `services.yaml` nor CI.

**Rationale**: They are one-off acceptance checks for a docs migration, not repeatable
project actions. The queue-id grep is exactly what the second proposal issue asks triage to
decide on, so wiring it in here would pre-empt that decision. See the Constitution Check
note on C4 in [plan.md](plan.md).
