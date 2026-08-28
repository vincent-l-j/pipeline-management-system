### Lint: an assertion must read a value the code under test produced

Enforces: "assert on what the code produced, not on what the test arranged" — now in
both the pytest and Vitest guidelines.
Observed: this mission's only contract failure and one of its four lessons trace to the
same shape. A test asserted `logging.getLogger().level` — a value its own setup had just
written — so the configured level silently stopped reaching uvicorn's loggers and no test
noticed. Two siblings in the same suite: `assert duration_ms >= 0`, which a hardcoded
zero satisfies, and `assert "Authorization" not in client.headers`, which asserts about
the fixture rather than the endpoint. Three instances in one milestone is a pattern, not
bad luck.
Approach: within a test body, flag an assertion whose subject has no data dependency on
the call under test. The analysis is tractable in both languages; the actual work is the
convention for identifying "the call under test" — plausibly the last call whose result
is bound before the first assert, which is how these suites are already shaped.
Cost: roughly one feature, most of it spent on the identifying convention and on
triaging the first run.
Existing violations: unknown; needs a run against both suites before it can be judged.
Confidence: **medium-low, and the honest recommendation is to decline for now.** The rule
has a judgment clause — asserting a constant the implementation must reproduce is
legitimate — so precision is the open question, and a check that fires on correct tests
gets suppressed by habit. The cheaper move that catches most of the value is the mutation
discipline the fix workers already applied by hand: break the implementation six ways and
confirm each break fails a test. If this proposal regenerates next mission, it has made
its own case.
