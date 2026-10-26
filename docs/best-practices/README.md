# Best-practices reference docs

Convention and rationale guidance for working in this repo. These complement — they
don't replace — `AGENTS.md` (boundaries + enforced conventions) and the code itself.

## Contents

- [`code-clarity.md`](code-clarity.md) — self-documenting code, when to comment,
  and why comments decay.
- [`backend-fastapi.md`](backend-fastapi.md) — FastAPI/Python patterns and pytest.
- [`frontend-react.md`](frontend-react.md) — React, Vitest, and Tailwind.
- [`database-integration.md`](database-integration.md) — how the frontend, backend,
  and database fit together, and the rules that keep them in sync.
- [`migrations.md`](migrations.md) — Alembic migrations, deployment, and rollback:
  how to evolve the Postgres schema safely and test forward/rollback.
- [`solid-principles.md`](solid-principles.md) — the design principles behind the
  conventions above.

## Keeping these docs in sync with the code

These docs deliberately anchor their advice to real code (file names, functions,
schemas) so the guidance is concrete. That creates a small, bounded upkeep
obligation. Follow these rules so the docs stay trustworthy rather than becoming
subtly-wrong lore:

1. **The code is the source of truth; the docs are orientation.** If a doc and the
   code disagree, the code wins — fix the doc. Examples are _illustrative pointers
   to a pattern_, not an authoritative catalog; a reader who follows a pointer to a
   moved symbol should still learn the pattern. The
   [constitution](../../.specify/memory/constitution.md) sits above both on
   principles: a doc that disagrees with it is corrected in the same change that
   notices it. If the doc seems right and the rule wrong, file a GitHub issue
   proposing an amendment and leave the doc deferring to the rule until the
   amendment lands. Docs cite rules by id ("C3") rather than paraphrasing them.
2. **Update the doc in the same change that alters the pattern it describes.** If a
   PR renames `require_role`, restructures a layer, or changes an established
   pattern, it edits the relevant doc too — same discipline as keeping a test with
   its implementation. This keeps drift near zero without a separate ritual.
3. **Prefer durable anchors over volatile ones, and reference rather than restate.**
   Reference stable structure (layers, directories, conventions like "no trailing
   slashes") in preference to a single function name, which is more likely to be
   renamed. Where another document already owns a fact, point at it by path rather
   than copying it — a copy has nothing keeping it true and drifts silently, since
   both versions still read correctly on their own. `AGENTS.md` names no viewports
   for this reason: it says to drive the app and sends the reader to
   `docs/agents/local-testing.md`, which owns why those widths. The same goes for
   anything a tool derives — file counts, line counts, tests passing, files
   touched. Name the command that produces the number rather than the number; the
   number is regenerated on every run and hand-copied once.
4. **Mark forward references, and assert only what is true on this branch.** If a
   doc cites a symbol that is _planned but not yet implemented_ (e.g. a schema
   described in an open issue but not yet built), say so ("planned as `X`") rather
   than presenting it as existing. The same holds for a capability that exists only
   on another, unmerged branch: neither branch can see the contradiction, and it
   surfaces only at merge. State the current truth, and let the commit that
   delivers the capability update the doc.
5. **No tooling needed.** A handful of short docs doesn't warrant link-checkers or
   doctests; reviewer attention plus rule 2 is sufficient. Add automation only if drift
   actually becomes a recurring problem.

What _doesn't_ rot, and is safe to rely on: the principles and conventions
themselves (server-side authz, tests-first, integrity-in-app-code, the SOLID
definitions). Only the anchoring examples need maintenance.

The same "fix it in the same change / code-wins" spirit applies to the
implementation-anchored parts of the workflow docs (the checks in a feature's
`tasks.md`, `services.yaml` commands).
