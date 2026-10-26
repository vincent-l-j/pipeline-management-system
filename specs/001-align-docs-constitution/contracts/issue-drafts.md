# Contract: GitHub issues filed by this feature

Every issue below, except the declined item 2, needs the user's confirmation before it is
created, because filing is outward-facing. `gh` is authenticated. Before filing, search open and
closed issues for an existing match (`gh issue list --state all --search "<terms>"`), and if
one exists, comment on it instead.

All issues are labelled `needs-triage`. None cites a `VAL-` id or a `mission/` path.

## From proposals (FR-016)

### 1. Lint: an assertion must read a value the code under test produced

- **Enforces**: assert on what the code produced, not on what the test arranged. This is in
  the testing sections of `docs/best-practices/backend-fastapi.md` and `frontend-react.md`.
- **Observed**: three tests in one suite had this shape.
  - `assert logging.getLogger().level == …` read back a value its own setup had just written,
    so a regression where the log level stopped reaching uvicorn's loggers went uncaught.
  - `assert duration_ms >= 0` is satisfied by a hardcoded zero.
  - `assert "Authorization" not in client.headers` asserts about the fixture, not the
    endpoint.
- **Approach**: within a test body, flag an assertion whose subject has no data dependency on
  the call under test. Take the call under test to be the last bound call before the first
  assert.
- **Cost**: roughly one feature, mostly spent on the identifying convention and triaging the
  first run.
- **Existing violations**: unknown; needs a run against both suites.
- **Confidence**: medium-low. The proposal recommended declining for now, in favour of manual
  mutation checks (break the implementation and confirm a test fails).

### 2. CI: fail on retired assertion ids left in tracked files — DECLINED, do not file

The user declined this on 2026-10-26: with the contract gone, no new ids can appear. Delete
the proposal file and record it as declined in the PR body. The draft is kept below only as
a record of what was declined.

- **Enforces**: durable files don't cite ids of things that get deleted. This is the
  ephemeral-ids section of `methodology.md`.
- **Observed**: the rule held only because prompts restated it, and one id was left behind in
  a `services.yaml` comment. This feature removes that id.
- **Approach**: a single `git grep -nIE '(VAL|val)-[A-Z]+-[0-9]{3}'` as a named
  `services.yaml` command that CI invokes (C4).
- **Cost**: well under a feature.
- **Confidence**: high precision.
- **Note for triage**: the validation contract no longer exists, so no new ids can appear.
  Unless the id scheme returns, `wontfix` is the likely outcome.

## Follow-ups found during research (not proposals)

### 3. Lint: add `eslint-plugin-react-hooks`

This would move the "memoize effect handlers" rule from prose into tooling. The current
eslint config has no hooks plugin.

### 4. Conformance gap: route CI and docs through `services.yaml` commands (C4)

- CI runs inline `pytest` variants and `format:prettier:check` instead of `services.yaml`
  names.
- `services.yaml` lacks `migrate`, `make-migration`, `test-migrations` and readiness commands.

### 5. Conformance gap: alerts without a symptom or runbook (A22)

The instance sheet's `MEM_UTILIZATION` and `RESTART_COUNT` alerts each need a user-visible
symptom and a runbook under `sop/`, or they should be deleted.

### 6. Test gap: the error-fallback reference appears in the log record

No test asserts that the reference shown on the error fallback is present in the backend log
record. Only the response header and the acknowledgement are covered.
