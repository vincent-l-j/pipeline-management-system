Design Principles
Separation of concerns and incentives
Each role has a single goal, and the system is structured so that nothing in an agent's trajectory pulls it away from that goal.

The orchestrator plans and decomposes an approach to the user's goal, and steers execution to completion, passing all validation gates. It avoids accumulating overly granular context, delegating all investigation and implementation to subagents and workers. It doesn't drive validation directly - the system injects validators at milestones to surface gaps.
Workers complete well-specified features with clear success criteria. They iterate until they believe the work is correct, then hand it off. But the final judgment on correctness is not their call. An independent validator decides that.
Validators evaluate completed work for correctness and completeness, surfacing bugs and gaps. They don't implement fixes - they surface issues to the orchestrator, which creates fix features that future workers implement.
Test-driven development at two levels
The same principle operates at two scales.

Each worker writes tests before code, so the tests reflect intended behavior rather than implementation details.
At the mission level, the orchestrator defines correctness first - creating a validation contract, a set of behavioral assertions that define success, before defining any features.
This ordering matters. When creating the validation contract, the orchestrator draws from its understanding of requirements. If it had created the features first, the contract would be influenced by the implementation it had already planned.

These assertions are later verified by fresh agents that exercise the system as a black box - using it the way a real user would - rather than inspecting the code that implements them.

Externalized state
No single agent needs to hold the complete picture in its context at once. The full state is distributed across shared artifacts: the validation contract, the feature list, research notes, operational guidelines, and an evolving knowledge base.

Each agent reads what's relevant to its current job. Even the orchestrator delegates deep investigation to subagents to avoid consuming every detail itself.

Model specialization
Different models have different strengths - reasoning, discipline, creativity, thoroughness, speed, cost. No single model is best at everything.

Once roles are cleanly separated, model choice becomes local to each role: broad planning and judgment for the orchestrator, reliable execution and cost efficiency for workers, thoroughness and skepticism for validators.

The System
With those principles in mind, here's how a mission actually runs.

A user describes what they want built. The orchestrator investigates and asks clarifying questions until the requirements are unambiguous.

Then it writes the validation contract - a finite checklist of testable behavioral assertions that define completion and correctness for the mission.

From there, it decomposes the work into features, where each feature is a bounded piece of implementation that claims which assertions it will fulfill. Features are grouped into milestones, each of which encompasses a logical unit of functionality.

Finally, it creates shared state files - boundaries and procedures for its workers that enforce optimal structure and behavior, as well as a library that will accumulate knowledge over the mission's duration.

validation-contract.md

```markdown
### VAL-AUTH-001: Successful login

A user with valid credentials submits the login form
and is redirected to the dashboard.
Tool: agent-browser
Evidence: screenshot, network(POST /api/auth/login -> 200)

### VAL-CROSS-001: Auth gates pricing

A guest user sees "Sign in for pricing" on the catalog.
After logging in, real prices are shown.
Tool: agent-browser
Evidence: screenshot(guest-view), screenshot(authed-view)
...
```

features.json

```json
[
  {
    "id": "auth-login-endpoint",
    "description": "POST /api/auth/login - Validate credentials, issue JWT, set session cookie.",
    "skillName": "backend-worker",
    "milestone": "authentication",
    "expectedBehavior": [
      "Returns 200 with session cookie on valid credentials",
      "Returns 401 with error message on invalid credentials",
      "Rate-limits after 5 failed attempts per IP"
    ],
    "verificationSteps": [
      "npm test -- --grep 'auth login'",
      "curl POST /api/auth/login with valid creds -> 200"
    ],
    "fulfills": ["VAL-AUTH-001"],
    "status": "pending"
  },
  ...
]
```

services.yaml

```yaml
commands:
  install: pnpm install
  typecheck: npm run typecheck
  build: turbo build
  test: npm run test
  lint: npm run lint

services:
  postgres:
    start: docker compose up -d postgres
    stop: docker compose stop postgres
    healthcheck: pg_isready -h localhost -p 5432
    port: 5432
    depends_on: []

  api:
    start: PORT=3100 npm run dev:api
    stop: lsof -ti :3100 | xargs kill
    healthcheck: curl -sf http://localhost:3100/health
    port: 3100
    depends_on: [postgres]
...
```

AGENTS.md

```markdown
## Mission Boundaries

**Port Range:** 3100-3101 only.

- Frontend: port 3100
- Backend: port 3101

**Database:**

- USE existing PostgreSQL on localhost:5432
- Do NOT start, stop, or modify the PostgreSQL server

**Off-Limits:**

- Ports 3000-3010 (user's dev servers)
- Any Docker containers not belonging to this project

Workers: return to orchestrator if you cannot
complete work within these boundaries.

## Coding Conventions

- TypeScript strict mode, no `any` types
- Prisma for all database access, no raw SQL
- JWT tokens in httpOnly cookies, bcrypt for hashing
- Socket.IO rooms: one room per channel ID
  ...
```

A programmatic runner takes the feature list and spawns a worker for each feature in order. Each worker starts with a fresh context, receives its feature spec, writes tests first, then implements.

Once all features within a milestone are complete, the runner triggers validation using fresh agents.

Scrutiny validators review each worker's implementation and trajectory for quality and correctness, and encode relevant knowledge updates into shared state.
User-testing validators exercise the system as a black box - using it the way a real user would - and verify behavior against the validation contract.
After validation, the orchestrator reviews what workers and validators flagged. It creates fix features targeted at actionable gaps, which get executed before the milestone re-validates. This loop repeats until milestone validation passes.

If implementation or validation is blocked, the orchestrator halts the mission and hands control back to the user.
