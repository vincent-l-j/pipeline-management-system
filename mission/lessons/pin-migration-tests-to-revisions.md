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
Rule: every assertion must be evaluated at a **pinned position**. That is narrower
than "never use `head`", and the difference matters, because two tests in the same
file use floating positions correctly. `test_dropped_column_values_do_not_survive_a_downgrade`
upgrades to `head` and returns to a named anchor: the journey lengthens as revisions
land, the destination does not, and the claim it makes — that seeded values do not
survive a trip up and back — legitimately grows stronger. `test_each_drop_is_a_separate_single_column_revision`
steps back with `-1`, but from a pinned start through a pinned list, and `-1`
granularity is the very property it asserts. The defect is only ever the combination
where the assertion point itself floats: `head` up and `-1` back names no fixed place,
so what the test steps over changes as the history grows.
Check: a call to `alembic("downgrade", "-1")` or `alembic("upgrade", "head")` after
which an assertion runs, where the landing revision is not fixed — neither named
outright nor reached by a pinned walk. Ask "which revision is the database at on this
line, and will that still be true after the next migration lands?"
