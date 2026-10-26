# Contract: outline of the rewritten `methodology.md`

The rewritten `methodology.md` must have these sections, in this order. Each bullet says what
the section must convey. The prose is the implementer's to write, in the repo's voice.

1. **Purpose.** How work moves from an idea to production in this repo, and which document
   owns what:
   - the constitution owns principles;
   - `AGENTS.md` owns conventions and version control;
   - `docs/best-practices/` owns rules learned in practice;
   - `services.yaml` owns commands.

   No link to `AGENT-READINESS.md`.

2. **Design principles.** These are kept:
   - **No self-validation.** Whoever implements a change does not decide it is correct.
     Correctness is measured against the spec's acceptance scenarios, through the
     `/speckit-analyze` and `/speckit-converge` gates and a PR review that cites constitution
     rules by id.
   - **TDD.** Tests come before code. At spec level, acceptance scenarios are written before
     the plan.
   - **State lives in artifacts,** not in an agent's head: the `specs/<feature>/` files,
     `AGENTS.md`, `services.yaml`, `docs/best-practices/`.
   - **Drain, don't grow.** No file is an append-only log. A spec directory records a feature;
     it isn't a status board.
   - **Learning from defects.** A defect means a rule was missing or unread. The rule is
     written into `docs/best-practices/` in the same PR that fixes the defect, merged into an
     existing rule where possible. No lesson queue.
   - **Rules graduate into tooling.**

3. **How a feature runs.** The Spec Kit steps (constitution once; specify, clarify, plan,
   checklist, tasks, analyze, implement, converge), each with one line on what it produces
   under `specs/<feature>/`. Also:
   - which steps are optional for small changes;
   - a pointer to `AGENTS.md` for branch, commit and PR rules (branch flow is not restated
     here);
   - done means deployed and observed (C6).

4. **Automating a rule.** Kept from the current doc, with "worker" and "milestone" wording
   removed: the three-step ladder, deleting prose once a check enforces it, the admission
   bar, and "what automates well". "Proposals never block" becomes: an idea for a check is
   filed as a GitHub issue labelled `needs-triage` and never blocks the current feature;
   triage accepts it (`ready-for-*`) or declines it (`wontfix`), and a good proposal
   regenerates.

5. **Ephemeral ids stay out of durable files.** Code, tests, comments and `docs/best-practices/`
   rules describe behaviour in plain prose. They never cite an id whose target may be deleted
   or renumbered (a task id from `tasks.md`, a branch name). Commit messages and PR bodies may
   cite issue and PR numbers.

**Must not appear as current practice**: an orchestrator, a runner, validators as a role,
milestones, worktree integration, the validation contract, `VAL-` ids, feature JSON files, a
`mission/` directory, `~/.missions`, missions running on `main`, or the pre-integration
checks.
