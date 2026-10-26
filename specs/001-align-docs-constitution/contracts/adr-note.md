# Contract: appended ADR note

An ADR is corrected only by appending this section at the end of the file. Nothing above it
changes.

```markdown
## Update YYYY-MM-DD

<What changed, in one or two sentences: the artifact, fact or rule the decision cited and
what happened to it.> <Whether the decision still stands.> <What guards the decided
behaviour now: test files or the constitution rule by id, by path.>
```

Rules:

- **The date** is the day the note is written. Notes accumulate in date order and are never
  edited later.
- **No ephemeral ids.** Name test files and rule ids, never task or queue ids.
- **If the decision no longer stands**, don't use a note. Write a new ADR that supersedes it.

## Instance: ADR 0002

What the note must convey:

- The behavioural assertions it cites were retired on 2026-10-25.
- The decision stands.
- Uploaded attachments remain the only specified and tested way to attach a file. They are
  guarded by `backend/tests/test_attachments.py`, `backend/tests/test_spaces_document_store.py`
  and the `PitchAttachments` component tests.
