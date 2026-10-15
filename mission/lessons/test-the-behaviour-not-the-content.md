### A test that asserts a consequence of today's content fails when the content changes

Observed: the pitch form's browser suite held "wraps the domain chips onto more than
one line", asserting the chips sat on more than one row at a phone width. Nothing
requires them to wrap; they only have to stay reachable on screen. The test passed
because today's domain labels happen to be too long for one row. Fewer or shorter
domains that fit on a single line would fail it while the layout was correct, and
the obvious fix at that point is to delete the test, which drops the guard with it.
Root cause: the assertion was derived from what the page looked like, not from the
requirement. `flex-wrap` was the mechanism; the test pinned a side effect of the
mechanism meeting the current data.
Rule: assert the behaviour or spec, not a consequence of the current content. Ask
what a user or the contract actually needs ("every chip is fully on screen"), and
assert that, so the test holds for any content that meets it and fails only when the
behaviour breaks. The replacement checks each chip's left and right edges against
the viewport: it passes on one line or three, and still fails, naming the chip, when
the wrap is removed.
Check: assertions on counts, line numbers, row totals or orderings that the spec
doesn't state, such as `lines.size > 1` or `toHaveLength(n)` for a literal `n`.
Ask whether the test would still pass if the content changed but stayed correct.
