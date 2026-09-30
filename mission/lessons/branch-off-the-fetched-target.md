### Branch off the freshly fetched target ref, not a local one

Observed: twice in one session, work was based on a commit that was not where the
target branch actually was. First, `develop` was read from a local ref that had not
been fetched — it showed `develop` as 14 commits behind `main` and a clean
fast-forward away, when `origin/develop` had in fact diverged with 3 unique commits
and 883 lines `main` had never seen. A recommendation was given on that reading and
had to be withdrawn. Then a follow-up branch was cut from `origin/develop` at
`9f91400`, the tip of a phase that had already landed on `main` as `e9bad9d` — a
**squash** merge. Same content, different commit. `git merge-base --is-ancestor
9f91400 origin/main` answers NO, and always will.
Root cause: a local branch ref is a cached answer to "where is this branch", and
`git branch`, `git log <branch>` and tab-completion all serve that cache without a
word about its age. The failure is quiet in both directions. A stale ref reports a
divergence that has been resolved, or hides one that has appeared; and after a squash
merge the feature branch's tip is _permanently_ absent from the target's history even
though every line of its diff is present. Content equality is what a reviewer checks
and what `git diff` reports, so the ancestry problem survives exactly the check most
likely to be run against it. Basing the next phase there means the merge replays a
commit whose changes are already in, on a base that never existed upstream.
Rule: `git fetch` before reading any branch's position, reason about `origin/<branch>`
rather than `<branch>`, and cut new work with an explicit remote base —
`git checkout -b <new> origin/main`. Before building a second phase on a first, assert
the ancestry rather than the diff: `git merge-base --is-ancestor <base> origin/<target>`.
If it says NO while `git diff origin/<target> <base>` is empty, the first phase was
squash-merged and the correct base is the target, not the branch it came from.
Check: a branch whose merge-base with its intended target is older than a commit whose
changes the target already contains; or advice about a branch's position given in a
session with no preceding `git fetch`.
