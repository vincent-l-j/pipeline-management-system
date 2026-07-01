# Best-practices reference docs

Convention and rationale guidance for working in this repo. These complement — they
don't replace — `AGENTS.md` (boundaries + enforced conventions) and the code itself.

## Contents

- [`backend-fastapi.md`](backend-fastapi.md) — FastAPI/Python patterns and pytest.
- [`frontend-react.md`](frontend-react.md) — React, Vitest, and Tailwind.
- [`database-integration.md`](database-integration.md) — how the frontend, backend,
  and database fit together, and the rules that keep them in sync.
- [`solid-principles.md`](solid-principles.md) — the design principles behind the
  conventions above.

## Keeping these docs in sync with the code

These docs deliberately anchor their advice to real code (file names, functions,
schemas) so the guidance is concrete. That creates a small, bounded upkeep
obligation. Follow these rules so the docs stay trustworthy rather than becoming
subtly-wrong lore:

1. **The code is the source of truth; the docs are orientation.** If a doc and the
   code disagree, the code wins — fix the doc. Examples are *illustrative pointers
   to a pattern*, not an authoritative catalog; a reader who follows a pointer to a
   moved symbol should still learn the pattern.
2. **Update the doc in the same change that alters the pattern it describes.** If a
   PR renames `require_role`, restructures a layer, or changes an established
   pattern, it edits the relevant doc too — same discipline as keeping a test with
   its implementation. This keeps drift near zero without a separate ritual.
3. **Prefer durable anchors over volatile ones.** Reference stable structure
   (layers, directories, conventions like "no trailing slashes") in preference to a
   single function name, which is more likely to be renamed.
4. **Mark forward references.** If a doc cites a symbol that is *planned but not yet
   implemented* (e.g. a schema described in `features.json` but not yet built), say
   so ("planned as `X`") rather than presenting it as existing. Reconcile it when
   the feature lands.
5. **No tooling needed.** Four short docs don't warrant link-checkers or doctests;
   reviewer attention plus rule 2 is sufficient. Add automation only if drift
   actually becomes a recurring problem.

What *doesn't* rot, and is safe to rely on: the principles and conventions
themselves (server-side authz, tests-first, integrity-in-app-code, the SOLID
definitions). Only the anchoring examples need maintenance.

The same "fix it in the same change / code-wins" spirit applies to the
implementation-anchored parts of the mission-control docs (`features.json`
`verificationSteps`, `services.yaml` commands). The black-box `validation-contract.md`
is deliberately implementation-independent and should not need this upkeep.
