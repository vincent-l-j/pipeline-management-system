### A finding good enough to file is often already filed

Observed: driving the app at a phone viewport turned up the pitch detail header
overflowing and its Delete action unreachable at 390px. It was measured twice,
reproduced independently by a second session, written up with both failure modes
and opened as a new issue. #128 already described it — filed by the repo owner
thirty minutes earlier, found the same way, and already triaged `ready-for-agent`
with acceptance criteria. The new issue was closed as a duplicate minutes after it
was opened, and its one non-overlapping measurement had to be moved to a comment
on the original. `gh issue list --state all --search "overflow phone"` returns
#128 as its second result; the search was never run.
Root cause: the routing rule said where a finding goes — a defect outside the
current change becomes a GitHub issue, per `docs/agents/issue-tracker.md` — and
said nothing about looking first, so the care went into the evidence instead of
into whether the evidence was wanted. A well-verified finding is the case that
feels _least_ like a duplicate, because the effort spent confirming it reads as
ownership of it. The timing compounds it: a shared runbook that sends several
agents to drive the same app makes independent rediscovery of the same defect the
expected outcome rather than a coincidence, and two sessions hit this one inside
half an hour. Nothing in either session could see the other's tracker writes.
Rule: search before opening, and search the closed issues too —
`gh issue list --state all --search "<terms>" --json number,title,state`. When one
already exists, comment the delta onto it rather than filing beside it: the
measurement it lacks, the second failure mode, the fixture implication. A comment
on a triaged issue reaches whoever implements it; a duplicate has to be noticed
and closed before it reaches anyone. If a duplicate does get opened, move the
delta to the original and close the new one as `duplicate` in the same pass —
leaving both open splits the discussion across two numbers.
Check: an issue opened in a session whose history contains no `gh issue list` or
`--search` beforehand. Also any instruction that routes findings to "file an
issue" with no search step in front of it — the gap is in the instruction, not in
the judgement of whoever followed it.
