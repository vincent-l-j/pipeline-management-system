# Rozetta PMS Constitution

## Core Principles

Core rules apply to every file, every plan, every diff. Activity rules (the sections after
this one) apply whenever the current work matches the activity; check the activity list at the
start of each plan step and at the start of each file written. Several activities can apply at
once.

Rules bind new plans and new code. Where existing code already violates a rule, its How To
Apply names the exception as grandfathered debt: it is not a precedent, and code that touches
it pays it down rather than extending it.

### C1. Optimize for deletion, not extension

**Rationale**: Working memory holds four to seven chunks, and change cost dominates creation
cost. A module that can be thrown away and rewritten is cheap to change; a wrong abstraction is
paid for by every change that has to route around it.

**Rule**: A module must be small enough that one engineer can delete and rewrite it in a day.
Reject speculative abstractions. Inline until it hurts, then extract. Duplication below three
occurrences is cheaper than the wrong abstraction.

**How To Apply**: A plan that introduces a base class, generic repository, shared hook,
service layer or interface names its three existing call sites, or it inlines instead. A file
or component a plan grows past one-day-rewrite size is split in the same plan. Every new
abstraction is recorded in the plan's Complexity Tracking table.

### C2. Make dependencies explicit

**Rationale**: Coupling determines blast radius. A dependency a reader cannot see is one a
change cannot account for, and one a test cannot substitute.

**Rule**: No hidden coupling, no implicit global state, no import-time side effects. A reader
must be able to see every dependency of a function in its signature or at the top of its file.
Dependency injection over singletons.

**How To Apply**: Backend handlers receive sessions, the current user, settings-derived
collaborators and external clients as injected parameters, never by constructing or importing
a live instance in the body. Frontend modules take what they need as arguments, props or
context, not from mutable module state.
Grandfathered: the module-level settings object and database engine/session factory in the
backend core; process logging configured as a side effect of importing the app module; the
mutable module-level request-id and in-flight state in `frontend/src/services/api.ts`; the
meeting-note parser reading its API key from the environment and constructing its model client
inline.

### C3. Test the transformation, not the plumbing

**Rationale**: A test earns its cost by failing when behaviour breaks. Mocks of your own code
encode its current shape, so they pass while the real seam breaks; boundaries are where
behaviour actually breaks.

**Rule**: Unit tests cover pure transformation logic. Integration tests cover the boundaries.
Do not mock what you own; do mock what you do not. A green CI without a failing test for the
bug you just fixed is not green.

**How To Apply**: A bug-fix task list starts with a test that reproduces the bug and fails;
the fix is not done until that test passes. Backend integration tests run against the real
database engine, not a substitute. External services (identity provider, LLM provider,
object store) are faked at their adapter; code the project owns is exercised, not mocked.
Grandfathered: frontend component tests mock the project's own HTTP client module, and backend
tests override the project's own current-user dependency. New tests do not add to either
pattern without recording the exception in the plan.

### C4. Commands are discoverable; local dev matches CI

**Rationale**: Coordination cost is superlinear. Every undocumented step and every gap between
a laptop and CI is a question someone has to ask, and a failure only one environment can show.

**Rule**: Every repeatable action (build, test, lint, migrate, deploy, seed) is a single named
command listed in one place and runnable with no hidden arguments. The command a developer
runs locally is the same command CI runs. If a new contributor cannot list every command in
30 seconds, the interface is broken.

**How To Apply**: `services.yaml` is the one place. A plan that adds a repeatable action adds
its command there, and CI invokes that same command rather than an inline shell equivalent.
Grandfathered: CI runs the frontend unit suite inside a container build target while the
local command runs it directly; closing that gap is the paydown.

### C5. Recovery over prevention

**Rationale**: Failure is certain and its timing is not. Time to recover bounds the damage of
every defect that prevention missed; prevention bounds only the ones it anticipated.

**Rule**: Every change must be revertible in under five minutes without a code change. Feature
flags gate risky paths. Migrations are expand-then-contract. Rollback is tested as part of the
deploy, not assumed.

**How To Apply**: Every plan states how its change is reverted and how long that takes. A
schema change ships as an additive migration with a working downgrade, then code tolerant of
both shapes, then a later contract step; a migration that cannot be reversed says so and names
the restore path. A change to authentication, data deletion or the deploy path is gated.
Grandfathered: there is no feature-flag mechanism and rollback is not rehearsed during deploy;
today recovery is redeploying the previous commit. The first plan that needs a flag introduces
the mechanism.

### C6. Value is realized at the user, not at merge

**Rationale**: Software has zero value until users touch it. A merged change that is not
deployed, or deployed and not observable, has produced cost and no evidence.

**Rule**: A PR is not done until the change is in the hands of users, observable, and
revertible. "Shipped" means deployed, instrumented, and monitored, not merged.

**How To Apply**: Each plan states how the change will be observed in production: which
structured log fields, request-correlated records or health signals show it working or
failing. A feature is complete when it is deployed to production and that signal has been
checked, not when its PR merges.

## Activity: writing UI code

### A4. Accessibility is a correctness property

**Rationale**: An interface is only correct for the users who can operate it. A control
unreachable by keyboard or unannounced by a screen reader is broken for those users in the same
way a 500 is broken for everyone.

**Rule**: Keyboard navigation, focus order, ARIA roles, and color contrast are not polish. Every
interactive element must be reachable by keyboard and announced by a screen reader. No
`<div onClick>` in new code.

**How To Apply**: Interactive elements are native controls (`button`, `a`, `input`, `select`)
or carry the matching role and keyboard handling. Tests query by role and accessible name, so
an element a screen reader cannot announce cannot be tested either. A plan that adds a custom
widget (menu, combobox, dialog, drag target) states its keyboard model and focus handling.

### A5. Render what you can prove

**Rationale**: A blank frame or an endless spinner tells the user nothing they can act on.
Every state a component can reach is a state some user will see, so each one is designed or
it is a defect.

**Rule**: No loading spinner without a timeout. No error state without a retry path. No empty
state without copy. A component that can render "nothing" must render a deliberate "nothing",
not a blank frame.

**How To Apply**: Every data-fetching view designs four states: loading, error, empty and
loaded. Its tests cover each. A request that can hang has a timeout that turns into the error
state.
Grandfathered: the shared HTTP client sets no request timeout, and most error states offer no
retry (the meeting-note importer and search page are the exceptions). A view a plan touches
gains both.

### A6. Measure what users feel

**Rationale**: Latency is felt at the user's device, not measured at the server. What is not
measured regresses one dependency at a time, and nobody notices until it is slow everywhere.

**Rule**: Core Web Vitals (LCP, INP, CLS) are the latency budget. Regressions are treated like
test failures. Bundle size is tracked per route; new dependencies that push over budget require
a written justification.

**How To Apply**: A plan that adds a frontend dependency states its size cost, and justifies
it in Complexity Tracking if it pushes a route over budget. Heavy, rarely used views are
split out of the initial bundle.
Grandfathered: neither Web Vitals nor per-route bundle size is measured yet, so there is no
budget to compare against. The first plan that adds a frontend dependency, or that
restructures routes, introduces the measurement and records the baseline.

### A7. State lives at the edge it is needed

**Rationale**: State held further from its use than necessary becomes shared mutable state,
which is coupling with a delay. Each kind of state has one natural owner and one natural
lifetime.

**Rule**: URL state is URL state. Server state is server state (cache, not store). Form state
is local. Global client state is the last resort.

**How To Apply**: Anything a user would bookmark, share or reach with the back button (the
selected record, filters, tab, search query) lives in the URL. Data fetched from the API is
treated as a cache of the server, refetched rather than edited in place as the source of
truth. Form inputs stay in the form component. A new context or other global store needs a
justification in Complexity Tracking; signed-in identity is the existing example of a valid
one.

## Activity: integrating an LLM or agent

### A16. Evals before features

**Rationale**: Model output is probabilistic, so a single passing example proves nothing.
Only a fixed set of cases run before and after a change can show whether a prompt or model
change helped or regressed.

**Rule**: No prompt, tool, or agent flow ships without an eval that would have failed before
the change and passes after it. Every change carries its regression case into the eval set.

**How To Apply**: The meeting-note parser's prompt, model choice and output handling change
only alongside an eval set of representative raw notes and expected structured records, run
against the real model. Each regression found in production becomes a case in that set.
Grandfathered: the parser has unit tests for its fallback parser and for a mocked model path,
but no eval set against the real model. The next change to the prompt or model builds it
first.

### A17. Context is a budget

**Rationale**: Every token is billed, adds latency, and dilutes the instructions that matter.
A stable prefix can be cached; a prefix that changes on every call cannot.

**Rule**: Tokens in context are a scarce, billed resource. Every prompt, tool schema, and memory
injection is justified against its cost. Cache-friendly ordering (stable prefix, volatile
suffix) is a correctness property.

**How To Apply**: Instructions and output schema go in a stable system prompt; the user's raw
notes go last. Input size and the output token limit are bounded and stated in the plan.
Grandfathered: the meeting-note parser interpolates the notes into a single user message
together with the instructions, so nothing is cacheable.

### A18. Tools are typed contracts

**Rationale**: A model chooses tools from their descriptions and fills arguments from their
schemas. An untyped or vaguely described tool produces unpredictable calls and unhandleable
failures.

**Rule**: Every tool has a JSON schema, a documented side-effect profile, and a deterministic
error taxonomy. Tool descriptions are prompts.

**How To Apply**: Applies the moment a model is given a tool, including structured-output
tools used only to shape a response. The plan lists each tool's schema, what it changes, and
the errors it returns, and the tool description is reviewed as prompt text.

### A19. Deterministic where possible, probabilistic where necessary

**Rationale**: Code is cheap, testable and repeatable; a model call is none of those. Using a
model where code would do adds cost and nondeterminism with no gain.

**Rule**: Parsing, formatting, retrieval, and routing are deterministic code. Use the model only
for the irreducibly probabilistic step (generation, classification without ground truth,
judgment). A regex beats a prompt for structured input.

**How To Apply**: The model extracts meaning from free-text notes; validating, normalizing and
mapping its output into the application's records is deterministic code with its own unit
tests. Prefer a typed structured-output mechanism to scraping JSON out of free text.
Grandfathered: the meeting-note parser recovers JSON from the model's reply by regex when it
does not parse cleanly.

### A20. Separate agent authority from side-effect blast radius

**Rationale**: A model can be wrong, or steered by its input. Its permissions must assume that,
because a mistake by a model with delete rights is a deletion.

**Rule**: Destructive tools (delete, send, pay, deploy) require human confirmation or a signed
pre-approval token. Agent permissions scale with eval coverage, not with demo needs.

**How To Apply**: Model output is a proposal a user confirms before it is saved; the
meeting-note importer fills a form, it does not write records. A plan that lets a model act
without confirmation names the eval coverage that justifies it.

## Activity: adding telemetry

### A21. Emit structured events, derive everything else

**Rationale**: A system is observable when its state can be inferred from its outputs, and
questions you have not thought of yet can only be answered from high-cardinality fields
recorded before the question arose.

**Rule**: Logs, metrics, and traces are projections of one primitive: the structured event.
High-cardinality fields (user id, request id, tenant id, feature flag state) are required, not
optional. No unstructured log lines in new code.

**How To Apply**: Every record is a single-line structured event carrying the request id and,
when authenticated, the acting user. Variable data travels as named fields, never interpolated
into the message text. A plan that adds an operation states the event it emits and its fields;
a metric or dashboard is derived from those events, not counted separately. Tenant id and
feature-flag state join the required fields once those concepts exist.

### A22. Attention is finite

**Rationale**: Attention is the scarcest resource in operations. An alert that fires without a
user-visible symptom teaches people to ignore alerts, including the one that matters.

**Rule**: Every alert corresponds to a user-visible symptom and a runbook. Dashboards are saved
queries, not decoration. Delete signals that have not fired a useful page in 90 days.

**How To Apply**: A plan that adds an alert names the user-visible symptom and adds its runbook
under `sop/`. Routine signals such as health probes stay out of the default log level. A
signal that never pages usefully is deleted rather than muted.

## Governance

- This constitution is read by every Spec Kit command. Each plan's Constitution Check names
  the core rules and every activity rule that applies to it, and states how the plan complies.
  A violation passes the gate only when justified in the plan's Complexity Tracking table.
- Reviews cite rules by id ("violates C2"). A rule a reviewer cannot point at a diff to
  enforce is removed.
- A rule earns its place by changing at least one plan or diff. Before an amendment adds a
  rule, ask whether deleting it would change any plan the agent produces; if not, it is
  decoration and stays out. Tool names, versions, style rules and workflow preferences live in
  `CLAUDE.md`, `AGENTS.md` and `docs/best-practices/`, not here.
- Adding an activity is a MINOR amendment and comes with that activity's first-principles
  reasoning. Removing or redefining a rule is MAJOR. Removing a grandfathered exception once
  it is paid down, or clarifying wording, is PATCH.
- Amendments land in a focused PR that states the motivation.

**Version**: 1.0.0 | **Ratified**: 2026-10-23 | **Last Amended**: 2026-10-23
