# Contract: precedence statement

`AGENTS.md` carries a short statement near the top with this meaning, and owns it. `CLAUDE.md`
links to the constitution and to that statement, without restating it. The best-practices
README carries the conflict rule.

**Statement (`AGENTS.md`)**: the constitution (`.specify/memory/constitution.md`,
linked) governs principles, and the Spec Kit commands check every plan against it. This file,
`AGENTS.md` and `docs/best-practices/` hold tool names, versions, style and workflow. Where one
of them seems to contradict the constitution, the constitution wins until it is amended.

**Conflict rule (best-practices README, beside "the code is the source of truth")**: a doc that
disagrees with the constitution is corrected in the same change that notices it. If the doc
seems right and the rule wrong, file a GitHub issue proposing an amendment and leave the doc
deferring to the rule until the amendment lands. Docs cite rules by id (for example "C3") and
don't paraphrase them.

Both texts must avoid restating any rule's content.
