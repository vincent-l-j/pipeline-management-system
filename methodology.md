# METHODOLOGY.md

How work moves from an idea to production in this repo: define correctness before
building, keep state in files rather than in anyone's head, and turn every defect
into a rule.

Each fact has one owner, and this document points at the others rather than
repeating them:

| Owner                                                                | Holds                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Principles every plan and diff is checked against, by id |
| [`AGENTS.md`](AGENTS.md)                                             | Boundaries, coding conventions, version control          |
| [`docs/best-practices/`](docs/best-practices/README.md)              | Rules learned in practice, one file per topic            |
| [`services.yaml`](services.yaml)                                     | Every build, test, lint and run command                  |
| `specs/<feature>/`                                                   | One feature's spec, plan and tasks                       |

## Design principles

**No self-validation.** Whoever implements a change doesn't decide that it is
correct. Correctness is measured against the acceptance scenarios in the feature's
spec, written before any plan exists. Two gates check it, `/speckit-analyze`
(spec, plan and tasks agree) and `/speckit-converge` (the code delivers what they
say), and then a PR review judges the diff against the spec and cites constitution
rules by id. Implementers iterate until they believe the work is right; the verdict
isn't theirs.

**TDD at two levels.** Tests come before code, so they encode intended behaviour
rather than whatever got built. At the feature level, acceptance scenarios come
before the plan, so "done" is defined from the requirement and not from an
implementation already in mind.

**State lives in files.** No one holds the whole picture. A feature's state is its
`specs/<feature>/` directory, the conventions are in `AGENTS.md`, the commands are
in `services.yaml`, and the rules are in `docs/best-practices/`. A fresh session
reads only what its job needs and can pick the work up from there.

**Drain, don't grow.** No file is an append-only log. A file that only grows is
accumulating a second copy of history git already holds, and it drifts. Finished
work leaves through a commit, not a status flag: a spec directory records what a
feature is, not how far along it got, and a rule that is now enforced by a check is
deleted from prose (see [Automating a rule](#automating-a-rule)).

**Learning from defects.** Every defect means some rule was missing or unread. The
PR that fixes a defect also writes the rule that would have prevented it into
`docs/best-practices/`, preferring to merge it into an existing rule over adding a
new one, because a short rule set is one that actually gets read. There's no queue
of lessons waiting for a later consolidation pass; the fix and the rule land
together.

**Rules graduate into tooling.** Prose is the weakest form of a rule: it depends on
being read, remembered and applied under pressure. A rule a machine can check is
strictly better, so `docs/best-practices/` is a staging area for whatever can be
mechanized.

## How a feature runs

Each step is a Spec Kit command, and each writes into `specs/<feature>/`:

1. **`/speckit-constitution`** — once per project, and again only for an
   amendment. Produces the constitution.
2. **`/speckit-specify`** — the feature's user stories, functional requirements,
   acceptance scenarios and success criteria, with no implementation detail.
   Produces `spec.md`.
3. **`/speckit-clarify`** — targeted questions about anything ambiguous, with the
   answers folded back into `spec.md`.
4. **`/speckit-plan`** — research, design and the Constitution Check, where every
   rule that applies is named and an exception is justified in Complexity
   Tracking. Produces `plan.md`, `research.md`, `data-model.md`, `contracts/` and
   `quickstart.md`.
5. **`/speckit-checklist`** — optional requirement-quality checklists under
   `checklists/`.
6. **`/speckit-tasks`** — a dependency-ordered `tasks.md`, grouped by user story so
   each story is an independently testable slice.
7. **`/speckit-analyze`** — a read-only consistency check across spec, plan and
   tasks. Fix what it flags at the source before building.
8. **`/speckit-implement`** — works through `tasks.md`, tests first.
9. **`/speckit-converge`** — checks the code against the spec, plan and tasks, and
   appends any unbuilt work as new tasks until it reports converged.

A small change can skip clarify and checklist; analyze and converge are the
correctness gates and always run. A bug fix starts with a
test that reproduces it and fails (C3).

Branches, commits and PRs follow `AGENTS.md` ("Version control"); they aren't
restated here. A change is done when it is deployed and the production signal its
plan's Constitution Check named has been checked, not when it merges (C6).

## Automating a rule

A rule written in prose is enforced by attention, and attention is the resource
under most pressure when someone is deep in an implementation. The same rule
expressed as a check is enforced by the build. So every rule has a ladder to climb:

1. **Prose `Check:`** — a human or reviewer judges it. Where every rule starts.
2. **Mechanical `Check:`** — a specific, repeatable procedure ("no vendor SDK
   imported outside `adapters/`"). Still run by a reader, but no longer a matter of
   taste.
3. **Automated check** — a lint rule, a type constraint, a test, or a script wired
   into `services.yaml`. Runs on every change, costs nothing to apply, cannot be
   forgotten.

**When a rule reaches step 3, delete it from `docs/best-practices/`** and move its
`Why:` into the check's failure message. A prose copy of an enforced constraint is a
second source of truth that can drift from the check, and it crowds out the rules
that _can't_ be automated. It also puts the explanation where it lands better — at
the moment of violation, naming the line, rather than in a document read before the
mistake was conceivable.

So `docs/best-practices/` shrinks as tooling grows. It never empties: "give each
unit one reason to change" is not going to become a lint rule. What survives
automation is precisely the set of rules requiring judgment — which is a good
description of what review is for.

### The admission bar

A check that fires on correct code is worse than no check. It gets suppressed, then
suppressed by habit, and the suppression comments become noise that hides the real
hits. Before a proposed check is accepted:

- **Run it against the existing codebase.** Every hit is triaged. If it flags code
  that is fine, the check is not ready — sharpen it or drop it.
- **Prefer precision over recall.** A check catching the blatant half of a rule with
  no false positives beats one catching all of it with a 10% noise rate.
- **Decide the migration up front.** Existing violations are either fixed as part of
  adopting the check, or baselined so the check only applies to changed lines.
  Baselining is usually right — it makes adoption cheap, which is what makes
  adoption happen — but a baseline that never shrinks is a permanent exemption, so
  it gets an owner and a direction.

Never disable or loosen a check to make a build pass. Fix the code, or delete the
check deliberately and say why.

### Proposals never block

Automation is infrastructure, not the feature in hand. Noticing that a rule could be
mechanized is valuable; stopping feature work to build the tool is almost never
worth it mid-flight.

So an idea for a check is filed as a GitHub issue labelled `needs-triage` (see
`docs/agents/issue-tracker.md`), stating the rule it would enforce, what was
observed, the approach, an honest cost and a confidence, and **the current work
carries on**. Triage then either:

- **Accepts** it — it becomes a feature like any other: specified with
  `/speckit-specify`, then relabelled `ready-for-agent` or `ready-for-human`; or
- **Declines** it — the issue is closed `wontfix`. The rule stays prose. Not every
  rule is worth a tool, and a declined proposal that keeps reappearing is itself a
  signal.

Declining is cheaper than it looks, because **a good proposal regenerates**. The
rule is still prose, so the next time the same defect class appears, someone files
the proposal again. You are not discarding an idea; you are declining to fund it
now, and letting the codebase re-raise it if it was right.

### What automates well, and what doesn't

The limit is rarely the analysis — it is whether the rule has a crisp definition:

- **Structural rules automate cleanly.** Import boundaries, naming, file layout,
  forbidden constructs, "no `instanceof` on your own hierarchy." AST-level lint
  rules.
- **Dataflow rules are harder but tractable.** "Assertions must be on the value the
  act step produced, not on setup" is a real check: within a test body, flag
  assertions whose subject has no data dependency on the call under test. It needs
  a convention for identifying that call, which is the actual work.
- **Rules with a judgment clause resist automation, and shouldn't be forced.** "One
  reason to fail per test" allows several assertions describing one outcome, so
  counting assertions produces a bad check. Look for the structural proxy instead —
  an act→assert→act→assert cycle in a single test body is duplication of scenario,
  and that _is_ detectable.
- **Detection without a verdict is still useful.** Duplication is the clearest case:
  finding near-identical blocks is off-the-shelf (any copy-paste detector), but
  whether duplication _should_ be abstracted is a judgment call, and often the
  answer is no. Wire the detector to file proposals rather than fail builds — the
  tool supplies candidates, a reviewer supplies the verdict.

That last pattern generalizes. When a rule can be _detected_ but not _decided_, the
check belongs in the proposal path, not in the build.

## Ephemeral ids stay out of durable files

Some ids name things that get deleted or renumbered: a task id in `tasks.md`, a
branch name, a scratch file. **Nothing durable may cite one**, or the reference
outlives the thing it names and a reader greps for it and finds nothing.

- **Durable, so no ephemeral ids:** code, test names, comments and
  `docs/best-practices/` rules. A test encodes the _behaviour_ —
  `test_login_with_valid_credentials_redirects_to_dashboard`, never a task number.
  A rule stands on its own in plain prose.
- **Point-in-time, so allowed:** commit messages, PR bodies and the files inside
  `specs/<feature>/`, which describe one change as of when it was made. Issue and
  PR numbers are permanent on GitHub and may be cited anywhere.
