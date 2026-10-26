# Data Model: Align Contributor Docs with the Constitution

This feature changes documents, not application data. The "entities" are the things the
implementation creates, edits or deletes, plus the rules each must satisfy. They refine the
Key Entities in [spec.md](spec.md).

## Constitution rule (read-only)

| Field              | Notes                                                          |
| ------------------ | -------------------------------------------------------------- |
| id                 | `C1`–`C6`, `A4`–`A7`, `A16`–`A22`. Stable, so docs cite it.    |
| rule, how to apply | The constitution owns these. Docs never paraphrase them.       |
| grandfathered      | A named list of existing exceptions. The only ones that exist. |

**Validation**: this feature never edits the constitution (FR-008).

## In-scope document

| Field     | Notes                                                                             |
| --------- | --------------------------------------------------------------------------------- |
| path      | One of the paths listed under "In scope" in spec Assumptions.                     |
| owning PR | Which PR in [tasks.md](tasks.md) edits it. A file edited by two PRs is sequenced. |

**Validation**: after the feature, the document has 0 conflicts (SC-001), every link resolves
(FR-014), and nothing presents the contract, queue, runner or `mission/` as live (SC-006).

## Conflict

| Field      | Values                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| location   | Document plus quoted passage.                                                                                                                                   |
| rule       | Rule id, or `stale-workflow` for references to the retired mission workflow.                                                                                    |
| kind       | 1: recommends a forbidden or grandfathered pattern. 2: weaker than, or contradicts, a rule. 3: an unlabelled grandfathered pattern. 4: a paraphrased principle. |
| resolution | `rewrite` (kinds 1 and 2), `label` (kind 3), `point` (kind 4), or `amendment-candidate`.                                                                        |

**Transitions**: `found` → one of `rewrite`, `label`, `point` or `amendment-candidate`.
`found` with no exit is not allowed (SC-002). Conformance gaps the docs can't close leave
through a follow-up issue (research R5), not through a fake `label`.

## Lesson (drained, then deleted)

| Field   | Values                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| file    | `mission/lessons/<slug>.md`, one of 9.                                                                                                         |
| outcome | `merge` (into an existing rule), `add` (new rule in an existing doc), `drop` (in favour of a rule id), `delete` (one-off or already enforced). |
| target  | Doc and section, for `merge` and `add`.                                                                                                        |

**Transitions**: `queued` → outcome → file deleted. Each outcome is stated in PR 4's
description (FR-015). Planned outcomes are in research R2.

## Proposal (converted, then deleted)

| Field | Values                                                               |
| ----- | -------------------------------------------------------------------- |
| file  | `mission/proposals/<slug>.md`, one of 2.                             |
| issue | A GitHub issue number once filed. Labelled `needs-triage`.           |
| body  | Enforces, observed, approach, cost, existing violations, confidence. |

**Transitions**: `queued` → user confirms → issue filed → file deleted, or `queued` →
declined → file deleted with no issue (FR-016). The assertion-target lint is filed, and the
queue-id grep is declined. Afterwards
triage moves it to `ready-for-*` or `wontfix`, outside this feature.

## Follow-up issue

A conformance gap, test gap, or tooling idea found during research (contracts/issue-drafts.md
items 3–6). It has the same shape and the same confirmation gate as a proposal issue, and it
isn't required by any FR. The user may decline to file any of them. If declined, the gap is
listed in the PR body instead.

## Amendment candidate

A GitHub issue for a case where a doc seems more correct than the constitution (FR-009).
**Research found none.** One gets created only if implementation turns one up.

## ADR note

An appended `## Update YYYY-MM-DD` section ([contracts/adr-note.md](contracts/adr-note.md)).
**Validation**: the diff of the ADR file adds lines only below the original last line
(FR-019).
