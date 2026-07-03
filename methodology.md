# Methodology

A multi-agent approach to building software: separate roles, define correctness
first, and keep state outside any single agent's head.

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
  They don't fix; the orchestrator turns their findings into fix features.

**TDD at two levels.** Workers write tests before code, so tests reflect intended
behavior. At the mission level, the orchestrator writes the validation contract
before any features — defining correctness from requirements rather than from an
implementation it has already planned. Assertions are later verified by fresh
agents exercising the system as a real user would.

**Externalized state.** No agent holds the whole picture. State lives in shared
artifacts — validation contract, feature list, research notes, guidelines, and an
evolving knowledge base — and each agent reads only what its job needs.

**Model specialization.** Once roles are cleanly separated, model choice becomes
local: planning/judgment for the orchestrator, reliable and cost-efficient
execution for workers, thoroughness and skepticism for validators.

## How a mission runs

1. The user describes the goal; the orchestrator investigates and asks clarifying
   questions until requirements are unambiguous.
2. It writes the **validation contract** — a finite checklist of testable
   behavioral assertions that define completion.
3. It decomposes the work into **features**, each claiming the assertions it
   fulfills, grouped into **milestones**.
4. It creates shared state files (boundaries, procedures, knowledge base).

A programmatic runner spawns one worker per feature, in order. Each starts fresh,
writes tests first, then implements. When a milestone's features are all done, the
runner triggers validation with fresh agents:

- **Scrutiny validators** review each worker's implementation and trajectory,
  encoding knowledge updates into shared state.
- **User-testing validators** exercise the system as a black box against the
  validation contract.

The orchestrator then turns actionable findings into fix features, which run before
the milestone re-validates. The loop repeats until validation passes. If
implementation or validation is blocked, the orchestrator halts and hands control
back to the user.

## Artifacts

**validation-contract.md** — behavioral assertions:

```markdown
### VAL-AUTH-001: Successful login
A user with valid credentials submits the login form and is redirected to the dashboard.
Tool: agent-browser
Evidence: screenshot, network(POST /api/auth/login -> 200)
```

**features.json** — the feature list; each entry declares `fulfills` and
`verificationSteps`:

```json
{
  "id": "auth-login-endpoint",
  "description": "POST /api/auth/login - Validate credentials, issue JWT, set session cookie.",
  "milestone": "authentication",
  "expectedBehavior": ["Returns 200 with session cookie on valid credentials", "Returns 401 on invalid"],
  "verificationSteps": ["npm test -- --grep 'auth login'"],
  "fulfills": ["VAL-AUTH-001"],
  "status": "pending"
}
```

**services.yaml** — canonical build/run/test commands and service definitions.

**AGENTS.md** — mission boundaries (ports, databases, off-limits resources) and
coding conventions. Workers return to the orchestrator if they can't complete work
within these boundaries.
