### Grep check: no queue id in a tracked file outside the queue

Enforces: ids name files that get deleted when their entry drains, so nothing durable
may reference one — a reference that outlives the thing it names sends the next reader
grepping for something that no longer exists.
Observed: the rule held this mission — three independent validators grepped the tree and
found no `VAL-` id or feature id in any source file, test name, docstring or comment. But
it held because five worker prompts each restated it, and nothing would have caught a
slip. The one place it is genuinely tempting is a test docstring, where citing the
assertion feels like traceability.
Approach: a shell one-liner wired into `services.yaml` and the CI `format`/`lint` job —
`git grep -nIE '(VAL|val)-[A-Z]+-[0-9]{3}' -- . ':!mission'` plus the current feature
ids, failing on any hit. No AST work, no dependency.
Cost: well under a feature — the check is one line; the work is choosing where it runs
and writing the failure message.
Existing violations: zero, verified. Nothing to baseline, so adoption is free.
Confidence: high. Precision is exact for the `VAL-` pattern. Feature ids are ordinary
kebab-case words and would over-match, so the check should cover the `VAL-` form only
and leave feature ids to review — recall traded for zero false positives, deliberately.
