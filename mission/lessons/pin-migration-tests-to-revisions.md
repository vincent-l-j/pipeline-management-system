### A migration test pins both ends to revisions, never `head` or `-1`

Observed: a test for the revision that drops `pitch_file_links` upgraded to the
revision before it, then to `"head"`, then stepped back with `downgrade -1`. It passed
— but only because the drop happened to _be_ head at the time it was written. Adding
any revision on top breaks it: the upgrade runs past the drop to the new head, and
`downgrade -1` then reverts that newer revision instead, leaving the table still
absent and the final assertion failing. Confirmed by writing a throwaway no-op
revision on top and rerunning: the relative form failed exactly there, the pinned form
passed.
Root cause: `head` and `-1` are positions in a history that keeps growing, while the
test is a claim about one fixed revision. The two agree only while that revision is
the newest, which is precisely when the test is written and reviewed — so the defect
is invisible at the moment anyone would look for it, and surfaces later as a failure
in a test whose subject has nothing to do with the change that triggered it. The
person who pays is whoever adds the next migration, and the red they get points at
someone else's feature.
Rule: name the revision on both ends — `alembic("upgrade", _THE_REVISION)` and
`alembic("downgrade", _THE_ONE_BEFORE)` — so the test steps over exactly the revision
it is about, wherever head ends up. `head` belongs only in tests whose subject really
is the whole chain, such as the round-trip and `alembic check` cases. Relative steps
are safe only when the walk itself is pinned, as in the single-column-drop test, which
upgrades to each listed revision before stepping back through the same list.
Check: a test under `tests/migrations/` that names a specific revision in one call and
uses `"head"` or `"-1"` in another.
