# Linked files are removed; uploaded attachments are the only way to attach a file

Rozetta PMS grew two answers to one client request — "drag and drop an attachment
into a pitch". **Linked files** (`pitch_file_links`) stored a typed-in path to a
file living somewhere else, such as `S:\Pitches\AgriTech\proposal.pdf`.
**Attachments** (`pitch_attachments`) upload the file itself into the document
store. We are keeping attachments, deleting linked files, and dropping the
`pitch_file_links` table.

The deciding factor is that only one of the two is covered by the behavioural
assertions in `mission/contract/`. Attachments were specified, built against
assertions and validated; linked files predate that contract and are asserted
nowhere. Two ways to attach a file to a pitch is one more than the product needs,
and the unasserted one is the one to lose.

## Considered Options

**Keep both.** Rejected. The distinction — "does this file live in our store or on
a network drive?" — is one users have to hold in their heads at the moment they are
trying to do something else. The two boxes sat one above the other on the pitch
detail page with near-identical affordances and no cue about which to use.

**Keep linked files and extend them to SharePoint.** This was genuinely underway on
the unmerged local branch `feat/sharepoint-upload`, which adds
`sharepoint_item_id`, `sharepoint_drive_id`, `web_url` and upload metadata to
`pitch_file_links`. Rejected on two grounds. First, downloads would then be
governed by SharePoint's permissions rather than ours, so the backend stops being
the only security boundary and least-privilege responses become SharePoint's
problem instead of ours. Second, that branch's migration descends from a revision
that `main` has already built past, so it lands as a second Alembic head and needs
rebasing regardless. **That branch is abandoned, not pending.** It is left in place
unpushed; this document is the record that it was rejected rather than forgotten.

**Delete the table, or rename it into the future SharePoint pointer.** We deleted
it. A UNC path and a SharePoint `web_url` look alike and are not alike: one is a
string only meaningful to someone on the office network, with no way to check it
still resolves; the other is a URL the backend can fetch and proxy under
`require_role`. Reusing the table would have carried a column named `file_path`,
holding values of a different kind, under a name that describes neither. If the
pointer approach is ever revived, it should get its own table.

## Consequences

Any path a user typed into the linked-files box is gone. This was checked before
the drop: staging and production both held zero rows, which is why no export step
was needed. Had there been rows, this decision would have needed a migration plan
rather than a drop.

The removal ships as two deploys, because the migration suite asserts that models
and migrations never disagree (`alembic check`) and because `PRE_DEPLOY` migrates
before the new release goes live. The first deploy removes the UI, both endpoints,
the schemas and the ORM relationships, leaving the table standing but referenced by
nothing; the second drops the table together with its model. A single deploy would
have dropped the table while code that still cascaded into it was serving, turning
every pitch deletion in that window into a 500.

Pitch deletion no longer cascades into `pitch_file_links`, because the relationship
that performed that cascade is gone. Between the two deploys the foreign key still
exists with no ORM cascade behind it, so deleting a pitch that had linked-file rows
would fail on the constraint — harmless here only because that set is empty and no
endpoint remains that could add to it.
