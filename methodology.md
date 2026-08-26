# METHODOLOGY.md

A multi-agent approach to building software: separate roles, define correctness
first, and keep state outside any single agent's head.

This is what a repository does once it is *agent ready* — see
[AGENT-READINESS.md](AGENT-READINESS.md) for the foundation this assumes.

## Design principles

**Separation of concerns.** Each role has one goal, and nothing in an agent's
trajectory pulls it away from it.

- **Orchestrator** — plans and decomposes the work, then steers execution to
  completion. It delegates all investigation and implementation to subagents to
  avoid accumulating granular context, and doesn't self-validate; the system
  injects validators at milestones.
- **Workers** — implement well-specified features, iterating until they believe
  the work is correct. Final correctness is not their call.
- **Validators** — judge completed work as a black box, surfacing bugs and gaps.
  Before judging, each validator reads the standards its verdict will be measured
  against — the validation contract, `AGENTS.md` conventions, and the
  `best-practices/` entries relevant to what it's reviewing. They don't fix; the
  orchestrator turns their findings into fix features.

**TDD at two levels.** Workers write tests before code, so tests reflect intended
behavior. At the mission level, the orchestrator writes the validation contract
before any features — defining correctness from requirements rather than from an
implementation it has already planned. Assertions are later verified by fresh
agents exercising the system as a real user would.

**Externalized state.** No agent holds the whole picture. State lives in shared
artifacts, and each agent reads only what its job needs.

**Artifacts are queues that drain.** Every mutable artifact holds *outstanding*
work only. An entry that is finished is **deleted, not marked done** — because the
finished thing is already recorded somewhere durable:

| Queue — shrinks as work completes | Drains into — the durable record |
| --- | --- |
| `mission/features/<id>.json` | the implementation commit |
| `mission/contract/VAL-<id>.md` | an automated test |
| `mission/lessons/<id>.md` | a rule in `best-practices/` |
| `mission/proposals/<id>.md` | a feature that builds a check, or nothing |

The queue is one file per entry, so parallel workers touch disjoint files. There is
no `status` field: presence in the queue *is* pending, absence *is* done. An empty
queue directory means the mission is complete.

Non-goal: **no artifact is an append-only log.** If a file only grows, it is
accumulating a second copy of history that git already holds, and it will drift.

**Learning from defects.** Every validated defect means some rule was missing or
unread. Findings become both a fix feature and a lesson; lessons that recur are
promoted into `best-practices/`, which is what the next worker reads before writing
code and the next validator reads before judging it. Promotion prefers *merging into
an existing rule* over adding a new one — that is what keeps the rule set short
enough to actually be read.

**Rules graduate into tooling.** Prose is the weakest form of a rule: it depends on
being read, remembered, and applied under pressure. A rule that a machine can check is
strictly better, so `best-practices/` is not the last stop — it is a staging area for
whatever can be mechanized. See [Automating a rule](#automating-a-rule).

**Model specialization.** Once roles are cleanly separated, model choice becomes
local: planning/judgment for the orchestrator, reliable and cost-efficient
execution for workers, thoroughness and skepticism for validators.

## How a mission runs

1. The user describes the goal; the orchestrator investigates and asks clarifying
   questions until requirements are unambiguous.
2. It writes the **validation contract** — a finite set of testable behavioral
   assertions that define completion, one file per assertion under
   `mission/contract/`.
3. It decomposes the work into **features**, one file per feature under
   `mission/features/`, each claiming the assertions it fulfills and grouped into
   **milestones**. Each feature declares its `dependsOn` features, forming a
   dependency graph that fixes the execution order.
4. It confirms the shared state files exist: `AGENTS.md`, `services.yaml`, and
   `best-practices/`.

A programmatic runner walks the dependency graph and spawns workers accordingly:
features with no unmet dependencies run **in parallel**; a feature whose
`dependsOn` lists aren't yet complete waits until they are, so dependent work runs
**sequentially**. Parallel workers each run in their own **git worktree** so their
changes stay isolated and don't collide on a shared checkout.

Each worker starts fresh, reads the relevant `best-practices/` entries, writes tests
first, implements, and hands off by **committing locally in its worktree** — tests
included, green at the tip. The commit also **deletes the worker's own
`mission/features/<id>.json`**. Spec and implementation land in one commit, so they
cannot desync, and `git show` on that commit yields both. Worktrees don't push
branches and don't open pull requests; review is the validators' job, so there is
nothing for a PR to gate.

Parallel features are independent by definition — they never wait on each other, and
anything with a real dependency runs sequentially instead. **Commit each completed
feature before starting the next**, so each feature is an isolated, revertable commit
and later work never blurs into an earlier one's diff.

When all of a milestone's features are complete, the runner **integrates them into a
linear history**: it rebases each feature's commits onto `main` in dependency
order, one feature at a time, running that feature's `verificationSteps` after each
rebase. The result is a straight line of commits with no merge commits and no
long-lived branches; conflicts surface at integration time and go back to the
orchestrator as fix features. Once integration is green, the runner triggers
validation with fresh agents:

- **Scrutiny validators** review each worker's implementation and trajectory
  against the `best-practices/` entries that apply to it.
- **User-testing validators** exercise the system as a black box against the
  validation contract.

The orchestrator then turns actionable findings into fix features, which run before
the milestone re-validates. **Each actionable finding also produces a lesson** under
`mission/lessons/` — what broke, the root cause, and the rule that would have
prevented it — so the same defect class doesn't reappear in the next milestone.

At the end of each milestone the orchestrator runs a **consolidation pass** over the
lessons: merge duplicates, delete one-offs and anything already enforced by a test or
a linter, and promote whatever recurs into `best-practices/`. A promoted or rejected
lesson file is deleted — its content now lives in the rule, or nowhere. The same pass
asks which rules could be **automated**, and writes a proposal for each — see below.
The loop repeats until validation passes. If implementation or validation is blocked,
the orchestrator halts and hands control back to the user.

**A mission is complete when every queue is empty.** Not "when the features are done" —
every directory under `mission/`: no queued features, no contract assertion that isn't an
automated test, no unconsolidated lesson, no undecided proposal. Each has exactly two
ways out, and both are taken deliberately.

That makes the final step trivial rather than lossy: deleting `mission/` removes empty
directories. There is nothing to rescue at the end, because nothing can accumulate to the
end. If the directory isn't empty, the mission isn't finished — that's the check, and it
is the same statement as "queues drain," applied to the mission as a whole.

Every version of the directory remains in history.

## Automating a rule

A rule written in prose is enforced by attention, and attention is the resource under
most pressure when an agent is deep in an implementation. The same rule expressed as a
check is enforced by the build. So every rule has a ladder to climb:

1. **Prose `Check:`** — a human or validator judges it. Where every rule starts.
2. **Mechanical `Check:`** — a specific, repeatable procedure ("no vendor SDK imported
   outside `adapters/`"). Still run by a reader, but no longer a matter of taste.
3. **Automated check** — a lint rule, a type constraint, a test, or a script wired into
   `services.yaml`. Runs on every change, costs nothing to apply, cannot be forgotten.

**When a rule reaches step 3, delete it from `best-practices/`** and move its `Why:` into
the check's failure message. This is the same anti-duplication rule as everywhere else: a
prose copy of an enforced constraint is a second source of truth that can drift from the
check, and it crowds out the rules that *can't* be automated. It also puts the
explanation where it lands better — at the moment of violation, naming the line, rather
than in a document read before the mistake was conceivable.

So `best-practices/` shrinks as tooling grows. It never empties: "give each unit one
reason to change" is not going to become a lint rule. What survives automation is
precisely the set of rules requiring judgment — which is a good description of what
validators are for.

### The admission bar

A check that fires on correct code is worse than no check. It gets suppressed, then
suppressed by habit, and the suppression comments become noise that hides the real hits.
Before a proposed check is accepted:

- **Run it against the existing codebase.** Every hit is triaged. If it flags code that
  is fine, the check is not ready — sharpen it or drop it.
- **Prefer precision over recall.** A check catching the blatant half of a rule with no
  false positives beats one catching all of it with a 10% noise rate.
- **Decide the migration up front.** Existing violations are either fixed as part of
  adopting the check, or baselined so the check only applies to changed lines. Baselining
  is usually right — it makes adoption cheap, which is what makes adoption happen — but a
  baseline that never shrinks is a permanent exemption, so it gets an owner and a
  direction.

Never disable or loosen a check to make a build pass. Fix the code, or delete the check
deliberately and say why.

### Proposals never block

Automation is infrastructure, not the mission. Noticing that a rule could be mechanized
is valuable; stopping feature work to build the tool is almost never worth it mid-flight,
and an orchestrator that can widen its own scope this way will.

So a proposal is written to `mission/proposals/<id>.md` and **the mission carries on**.
The runner never schedules them. At the milestone boundary — where consolidation already
happens, and where stopping is cheapest — outstanding proposals are surfaced to the user
as a list, with the rule each would enforce and an honest estimate of what building it
costs. The user then either:

- **Accepts** — the proposal becomes a normal feature file, the dependency graph re-walks
  on the next scheduling pass, and the proposal file is deleted; or
- **Declines** — the proposal file is deleted. The rule stays prose. Not every rule is
  worth a tool, and a declined proposal that keeps reappearing is itself a signal.

There is no third option. Deferring is how a proposal queue becomes a backlog, and a
backlog is a file that only grows — the thing this design exists to avoid.

Declining is cheaper than it looks, because **a good proposal regenerates**. The rule is
still prose, so the next time the same defect class appears, consolidation writes the
proposal again. You are not discarding an idea; you are declining to fund it now, and
letting the codebase re-raise it if it was right. A proposal that keeps coming back has
made its own case.

### What automates well, and what doesn't

The limit is rarely the analysis — it is whether the rule has a crisp definition:

- **Structural rules automate cleanly.** Import boundaries, naming, file layout,
  forbidden constructs, "no `instanceof` on your own hierarchy." AST-level lint rules.
- **Dataflow rules are harder but tractable.** "Assertions must be on the value the act
  step produced, not on setup" is a real check: within a test body, flag assertions whose
  subject has no data dependency on the call under test. It needs a convention for
  identifying that call, which is the actual work.
- **Rules with a judgment clause resist automation, and shouldn't be forced.** "One
  reason to fail per test" allows several assertions describing one outcome, so counting
  assertions produces a bad check. Look for the structural proxy instead — an
  act→assert→act→assert cycle in a single test body is duplication of scenario, and
  that *is* detectable.
- **Detection without a verdict is still useful.** Duplication is the clearest case:
  finding near-identical blocks is off-the-shelf (any copy-paste detector), but whether
  duplication *should* be abstracted is a judgment call, and often the answer is no.
  Wire the detector to emit proposals rather than failures — the tool supplies
  candidates, a validator or the user supplies the verdict.

That last pattern generalizes. When a rule can be *detected* but not *decided*, the check
belongs in the proposal path, not in the build.

## Ids are queue-local

An id — `auth-login-endpoint`, `VAL-AUTH-001`, a lesson id — names a file that will be
deleted when its entry drains. So **nothing durable may reference one**, or the
reference outlives the thing it names and a reader greps for it and finds nothing.

- **Allowed:** queue-internal cross-references (`dependsOn`, `fulfills`). Both sides
  are ephemeral and disappear together, so they cannot dangle.
- **Allowed:** commit messages. They are point-in-time records, and the commit carries
  the spec in its own diff.
- **Forbidden:** code, test names, comments. A test drained from an assertion encodes
  the *behavior* — `test_login_with_valid_credentials_redirects_to_dashboard`, never
  `test_VAL_AUTH_001`.
- **Forbidden:** `best-practices/` rules, which live forever and are read to decide how
  to write code. A rule must stand on its own in plain prose.

## Branches

**Missions run on `main`.** There is no long-lived integration branch. The queue and
the code share one branch and one history, which is what lets a feature commit
atomically delete its own queue file — the property everything else here rests on.

This means `main` carries a `mission/` directory for the duration of a mission, and the
directory shrinks as work completes. That is the tradeoff, taken deliberately: keeping
`main` free of scaffolding would require rewriting every feature commit onto a second
branch, and rewritten commits are a second copy of work git already recorded — the
failure mode this methodology exists to avoid. A visible, draining queue is a smaller
cost than a promotion step that can drift.

Read the directory as a progress indicator rather than as clutter: its contents are
exactly the work that is still outstanding, and it is deleted when the mission ends.

Worktrees are still per-worker and short-lived. They are branched from `main`, rebased
back onto it at integration, and removed — see the milestone integration step above.

## Interrupts and plan changes

**Stopping mid-run needs no reconciliation.** The queue directory *is* the remaining
work, by construction. A worker killed before committing left no commit and no
deletion, so its feature is still queued — correct, with nothing to repair. Resume
discards that worktree and re-runs the feature.

**Abandoning is not completing.** A mission only completes with every queue empty, so a
mission given up on keeps its directory — accurately, since the entries in it are real
outstanding work. Ending it early is an explicit `chore: abandon mission` commit that
deletes the remaining queue files and says why in the body. The distinction matters when
reading history later: an empty directory means the work was finished, and that has to
stay true.

**Runtime state lives outside the repo**, at `~/.missions/<mission-id>/`: which
feature is in flight, attempt counts, worktree paths, logs, and **scheduling
priority**. Priority is a scheduling decision — which of the currently-ready features
to start first — not a spec change, so it costs zero commits no matter how often it
changes. (`dependsOn` is the hard constraint and stays in the queue file; priority
only breaks ties among features that are already unblocked.) This state is a cache: if
it is stale or missing, the runner rebuilds it by reading the queue directory and
`git log --diff-filter=D -- mission/features/`. Keeping it outside the repo means it
survives `git clean`, rebases, and worktree teardown, and is reachable from every
worktree at one absolute path.

**Adding or dropping features mid-mission is a first-class operation.** Write the new
queue files and commit them as `chore: queue <ids>`, with the reason in the
commit body. The plan's evolution is then itself in history, timestamped. The
dependency graph re-walks on the next scheduling pass. A feature abandoned rather than
built is deleted in its own `chore: drop <id>` commit, which distinguishes it
from one that completed.

This is also what makes history answer "what was *planned*," not just "what was done":

```sh
git log --diff-filter=A -- mission/features/   # everything ever planned
git log --diff-filter=D -- mission/features/   # everything ever completed or dropped
```

## Pre-integration checks

Before integrating a milestone, the runner verifies four invariants:

1. Every `VAL-` assertion is claimed by a queued feature or an existing test.
2. No queued feature has an unmet `dependsOn`.
3. Every feature commit deletes exactly one `mission/features/*.json`.
4. No tracked file outside `mission/` contains a queue id — the check that enforces
   the queue-local rule.

These are runner behavior and need no CI. A repo that wants them enforced on every push
can wire the same checks into its own pipeline; check 4 in particular is a plain grep
and is worth having run somewhere other than the process that could violate it.

## Artifacts

**`mission/contract/VAL-<id>.md`** — one behavioral assertion per file. Deleted when
the assertion is encoded as an automated test.

```markdown
### VAL-AUTH-001: Successful login

A user with valid credentials submits the login form and is redirected to the dashboard.
Tool: agent-browser
Evidence: screenshot, network(POST /api/auth/login -> 200)
```

**`mission/features/<id>.json`** — one feature per file. Deleted by the commit that
implements it.

```json
{
  "description": "POST /api/auth/login - Validate credentials, issue JWT, set session cookie.",
  "milestone": "authentication",
  "expectedBehavior": [
    "Returns 200 with session cookie on valid credentials",
    "Returns 401 on invalid"
  ],
  "verificationSteps": ["npm test -- --grep 'auth login'"],
  "fulfills": ["VAL-AUTH-001"],
  "dependsOn": ["user-schema"]
}
```

The filename is the id, so it isn't repeated inside. There is no `status` field.

**`mission/lessons/<id>.md`** — one lesson per file, written when a validator finds
something actionable. Deleted when promoted into a rule or rejected as a one-off.

```markdown
### Retry logic was untestable

Symptom: validator couldn't force the payment failure path.
Root cause: concrete `StripeClient` constructed inside `InvoiceService`.
Candidate rule: inject a payment-gateway interface at the constructor.
```

**`mission/proposals/<id>.md`** — one proposed automated check per file, written when
consolidation finds a rule a machine could enforce. Never scheduled by the runner;
surfaced to the user at the milestone boundary. Deleted when accepted (it becomes a
feature) or declined.

```markdown
### Lint: assertions must target the act step, not setup

Enforces: "Assert on behavior, not on implementation" (best-practices/testing.md).
Observed: three fix features this milestone came from tests asserting on fixture
values, which pass regardless of whether the code under test runs at all.
Approach: AST rule — flag assertions whose subject has no data dependency on the
call under test. Needs a convention for identifying that call.
Cost: ~1 feature. Existing violations: 14, baseline them.
Confidence: medium — precision needs checking against the current suite first.
```

**`best-practices/`** — durable, consolidated rules, one file per topic, each short
enough to be read in full by a worker or validator. Seeded with the design principles
the stack calls for, then grown only by promotion from lessons. Each rule states what
it is, why it exists, and how to check it — in self-contained prose, citing no ids:

```markdown
### Depend on abstractions, not concretions

Rule: modules own the interface they consume; they don't import a concrete
implementation across a layer boundary.
Why: an invoice service that constructed its payment client inline couldn't be
tested without network access, and the failure path was unreachable.
Check: no vendor SDK imported outside `adapters/`.
```

**`services.yaml`** — the canonical build/run/test commands and service definitions.
Workers build `verificationSteps` from it; validators reproduce failures with it.

**`AGENTS.md`** — mission boundaries (ports, databases, off-limits resources) and
coding conventions. Workers return to the orchestrator if they can't complete work
within these boundaries.
