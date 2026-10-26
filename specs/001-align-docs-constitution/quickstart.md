# Quickstart: validating the docs alignment

Run these from the repo root after each PR in [research.md](research.md) R11 lands, and run
all of them after the last one. Each check names the requirement or success criterion it
proves. They are one-off acceptance checks and aren't added to `services.yaml` (see the
Constitution Check in [plan.md](plan.md)).

Run them in bash. zsh doesn't word-split an unquoted `$DOCS`, so a check would silently
search nothing. The in-scope files used throughout:

```sh
DOCS="CLAUDE.md AGENTS.md README.md methodology.md services.yaml docs sop"
```

## 1. The retired workflow is gone (SC-006, FR-012, FR-017)

```sh
test ! -e mission && echo "mission/ removed"
git grep -nIE 'mission/|VAL-[A-Z]+-[0-9]{3}|VAL-\*|orchestrator|validation contract' -- $DOCS
```

**Expected**: `mission/ removed`, and the grep prints nothing. The one allowed exception is
the original text of ADR 0002 above its `## Update` note.

## 2. Every relative link resolves (FR-014)

```sh
git ls-files '*.md' | grep -vE '^(specs|\.specify|\.claude)/' | while read -r f; do
  grep -oE '\]\(([^)#]+)' "$f" | sed 's/](//' | grep -vE '^(https?:|mailto:)' | while read -r l; do
    [ -e "$(dirname "$f")/$l" ] || echo "$f -> $l"
  done
done
```

**Expected**: no output. Treat a hit inside a fenced code block as a false positive.

## 3. Precedence is reachable (SC-003, FR-004, FR-005)

```sh
grep -n 'constitution' CLAUDE.md AGENTS.md docs/best-practices/README.md
```

**Expected**: `CLAUDE.md` and `AGENTS.md` each link to `.specify/memory/constitution.md`, and
the README carries the conflict rule ([contracts/precedence-statement.md](contracts/precedence-statement.md)).

## 4. Known conflicts are resolved (SC-001, SC-002, SC-004)

Walk the table in research R4 file by file. Each row's passage is rewritten, labelled with its
rule id, or replaced by a pointer. These spot checks print nothing when done:

```sh
grep -nE 'three UI states|Prefer expand/contract|push that into a service|`api` mocked' -- docs/best-practices/*.md
grep -n 'without Postgres' docs/best-practices/solid-principles.md
```

These should print every grandfathered mention, each with its rule id on the same or an
adjacent line:

```sh
grep -nE 'mock(ing)? .?src/services/api|dependency_overrides|admin_client' -- AGENTS.md docs/best-practices/*.md
```

## 5. Lessons and proposals have outcomes (SC-007, FR-015, FR-016)

```sh
gh issue list --state all --search "assertion must read a value" --json number,title,labels
```

**Expected**: one issue, labelled `needs-triage`. No issue exists for the declined queue-id
grep proposal. PR 4's body lists all 9 lessons with their outcome and target, matching
research R2, and both proposals with their outcome.

## 6. The ADR is append-only (FR-019)

```sh
git diff --unified=0 d5c96f2 -- docs/adr/0002-remove-pitch-file-links.md | grep -E '^-[^-]'
```

**Expected**: no output, meaning no original line was removed or changed.

## 7. Docs-only and formatted (SC-005, FR-008, FR-010)

```sh
git diff --name-only <pr-base>...HEAD | grep -vE '\.md$|^services\.yaml$|^mission/' ; echo "exit: done"
npm run format:prettier:check
```

**Expected**: the first command lists no files other than `.md` files, `services.yaml`
(comments only, which you confirm by reading the diff) and deletions under `mission/`.
Prettier passes. `<pr-base>` is the branch the PR was cut from. Run this per story PR before
opening it. After all PRs merge there is nothing left to diff.

## 8. A cold read (User Stories 2 and 4)

Open `CLAUDE.md` in a fresh session and follow its workflow pointers to the end. Every
artifact named either exists or is created by a named `/speckit-*` command, and the
constitution is one link away.
