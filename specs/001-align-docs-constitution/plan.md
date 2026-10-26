# Implementation Plan: Align Contributor Docs with the Constitution

**Branch**: `001-align-docs-constitution` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-align-docs-constitution/spec.md`

## Summary

Bring every contributor-facing document into line with constitution v1.0.0, and retire the
mission workflow in favour of Spec Kit. The work has four parts:

- **Conformance**: guidance that recommends a forbidden or grandfathered pattern is
  rewritten. Accurate descriptions of existing debt are labelled with their rule id.
  Paraphrased principles become rule-id pointers.
- **Workflow**: `methodology.md` is rewritten around Spec Kit, keeping drain-not-grow, lesson
  promotion and rule-to-tooling graduation. Every reference to the deleted contract and the
  feature queue goes.
- **Draining**: the nine lessons are merged into best-practices, one proposal becomes a
  GitHub issue (the other is declined), and `mission/` is deleted.
- **History**: ADR 0002 gets an appended dated note.

It lands as a foundation PR plus five sequenced docs PRs, one per user story phase
([research.md](research.md) R11, [tasks.md](tasks.md)).

## Technical Context

**Language/Version**: Markdown (GitHub-flavoured) and YAML comments. No code.

**Primary Dependencies**: Prettier 3.9.6 (root `format:prettier:check`) for formatting. The
`gh` CLI for filing issues (authenticated).

**Storage**: N/A

**Testing**: The search-based acceptance checks in [quickstart.md](quickstart.md), plus the
Prettier check. No application test changes (FR-008).

**Target Platform**: Readers: contributors and AI agents working in the repo; GitHub renders
the files.

**Project Type**: Documentation change inside a web application monorepo.

**Performance Goals**: N/A

**Constraints**:

- No edits to the constitution, application code, tests, CI workflows or `services.yaml`
  commands. Only `services.yaml` comments may change.
- ADRs are append-only.
- Durable docs carry no ephemeral ids.
- Every issue is filed only after the user confirms it.

**Scale/Scope**:

- About 17 files edited: `CLAUDE.md`, `AGENTS.md`, `README.md`, `methodology.md`,
  `services.yaml`, `docs/architecture.md`, 6 best-practices docs, 2 agent docs, 1 ADR and 2
  SOP files.
- 11 files deleted under `mission/`.
- 1 required GitHub issue (one proposal is declined) and up to 4 optional ones.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Activity rules**: none apply. This plan writes no UI code (A4–A7), integrates no LLM
(A16–A20), and adds no telemetry or alerts (A21–A22). Where the docs describe those areas, they
gain rule-id pointers only, and those are documentation, not activity work.

| Rule                          | Applies                        | How the plan complies                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 Optimize for deletion      | Yes                            | Introduces no abstraction. The net effect is deletion: the runner sections of `methodology.md`, and `mission/` with all its queues. No doc grows past a one-sitting rewrite; `methodology.md` shrinks.                                                                                                                                                |
| C2 Explicit dependencies      | No (no code)                   | Documentation only labels the grandfathered C2 exceptions. It doesn't change them.                                                                                                                                                                                                                                                                    |
| C3 Test the transformation    | Partly                         | No code or bug fix, so no repro test is needed. The plan's own acceptance checks exercise the real files rather than a proxy. The docs stop recommending own-code mocks.                                                                                                                                                                              |
| C4 Discoverable commands      | Yes, and needs a justification | Adds no repeatable action. The quickstart searches are one-off acceptance checks for a migration that happens once, so they don't go in `services.yaml`. The one search that might recur (the queue-id grep) was declined as a proposal. The existing C4 gaps the research found go to a follow-up issue (R5).                                        |
| C5 Recovery over prevention   | Yes                            | **Revert**: each PR is undone by `git revert <merge>`, which takes under 5 minutes with no code change. The lessons deleted in the drain PR can be restored by the same revert. Filed issues are closed by hand if that PR is reverted. Docs, auth, data deletion and the deploy path are untouched, so no flag is needed.                            |
| C6 Value realized at the user | Yes                            | **Observation**: no runtime behaviour changes, and CI and deploy skip `docs/`, `*.md` and `mission/`. The equivalent "deployed and observed" for docs: each PR is merged to `main` and checked by running [quickstart.md](quickstart.md) against `main`, with the cold read (check 8) done by a fresh session. Done when those checks pass on `main`. |

**Result**: PASS. C4's deliberate omission and C6's reading for docs are recorded under
Complexity Tracking.

**Post-design re-check (after Phase 1)**: PASS, unchanged. The design added contracts that
constrain wording only. It added no tooling, commands or abstractions.

## Project Structure

### Documentation (this feature)

```text
specs/001-align-docs-constitution/
├── plan.md                         # This file
├── research.md                     # Phase 0: decisions R1–R12
├── data-model.md                   # Phase 1: entities and their transitions
├── quickstart.md                   # Phase 1: acceptance checks
├── contracts/
│   ├── methodology-outline.md      # Required shape of the rewritten methodology.md
│   ├── precedence-statement.md     # Constitution precedence plus conflict rule
│   ├── adr-note.md                 # Append-only ADR note format, plus the 0002 instance
│   └── issue-drafts.md             # Proposal and follow-up issue bodies
├── checklists/requirements.md
└── tasks.md                        # Phase 2 (/speckit-tasks; not created here)
```

### Files this feature touches (repository root)

```text
CLAUDE.md                     constitution-precedence · spec-kit-workflow
AGENTS.md                     constitution-conformance · constitution-precedence · spec-kit-workflow · drain-mission-queues (lesson) · definition-of-done
methodology.md                spec-kit-workflow (rewrite)
services.yaml                 spec-kit-workflow (comments only)
README.md                     constitution-conformance (labels) · spec-kit-workflow (broken link)
docs/
├── architecture.md           constitution-conformance
├── adr/0002-…md              spec-kit-workflow (appended note)
├── agents/
│   ├── issue-tracker.md      spec-kit-workflow · drain-mission-queues (lesson)
│   └── local-testing.md      spec-kit-workflow · drain-mission-queues (lesson)
└── best-practices/
    ├── README.md             constitution-precedence · spec-kit-workflow · drain-mission-queues (lesson)
    ├── solid-principles.md   constitution-conformance
    ├── frontend-react.md     constitution-conformance · drain-mission-queues (lessons)
    ├── backend-fastapi.md    constitution-conformance · drain-mission-queues (pointer)
    ├── database-integration.md constitution-conformance · spec-kit-workflow
    └── migrations.md         constitution-conformance · drain-mission-queues (lesson)
sop/
├── db-change.md              constitution-conformance
└── instances/rozetta-pms.md  spec-kit-workflow
mission/                      drain-mission-queues (delete)
```

**Structure decision**: there is no source tree. The layout above maps each file to the PR
that edits it (each name is a `docs/` branch from [tasks.md](tasks.md)), so the shared files (`AGENTS.md`, `frontend-react.md`, `migrations.md`, the
best-practices README and the agent docs) are edited in order and never by two PRs at once.

## Complexity Tracking

| Violation                                                                                      | Why Needed                                                                                                                                    | Simpler Alternative Rejected Because                                                                                                 |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| C4: the quickstart acceptance searches are not added to `services.yaml`                        | They verify a one-time migration. After it, no new contract ids or `mission/` paths can be created, so a recurring check would guard nothing. | The user declined the queue-id grep proposal. Wiring it in anyway would also edit CI, which is outside the docs-only scope (SC-005). |
| C6: "deployed and observed" is read as "merged to `main` and the quickstart checks pass there" | Docs have no production deployment or runtime signal.                                                                                         | Leaving C6 as "not applicable" would leave no done signal at all, contradicting FR-020's "done means deployed and observed".         |
