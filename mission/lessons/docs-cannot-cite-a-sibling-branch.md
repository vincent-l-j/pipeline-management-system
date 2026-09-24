### A doc may only assert what is true on its own branch

Observed: `services.yaml` on `test/browser-layout-coverage` said the browser suite
"needs a Chromium baked into the dev container image" and that
`.devcontainer/verify-deps.sh` "fails on rebuild if it is missing, so a failure here
on a container that came up green is about the code, not the toolchain". Both
sentences are true — on `chore/devcontainer-tooling-in-image`, which is unmerged. On
the branch that shipped them, `.devcontainer/` contained no Chromium and
`verify-deps.sh` had no browser check. The note inverted the advice it existed to
give: on that branch a failure _was_ the toolchain, and the doc told the reader to go
looking at their code.
Root cause: the sync rule in `best-practices/README.md` — code wins, update the doc in
the same change — is scoped to a commit, and the author was holding two branches in
their head at once. Neither branch can detect the split. The branch with the claim has
no Chromium to contradict it; the branch with the Chromium has no claim to check. Both
are green, and the desync exists only in the union, which nothing builds until merge.
Rule: a doc asserts what is true on its own branch, not what a sibling branch will
make true. A capability that lives on another branch is a forward reference — either
mark it as one ("planned as X"), or state the current truth and let the branch that
lands the capability update the doc in the same commit. The note describing a
capability belongs to the commit that provides it, which is also the only commit that
can be reviewed against it.
Check: a doc or comment asserting that some tooling exists, where grepping the same
branch for that tooling finds nothing.
