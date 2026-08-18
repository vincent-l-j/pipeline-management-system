"""drop pitch_contacts.role_in_pitch

Revision ID: f7b5c2e93a41
Revises: e6a4d81c37b2
Create Date: 2026-08-17 00:00:00.000000

`role_in_pitch` (the role a contact played on one specific pitch) was dead on
arrival: declared on the `PitchContact` model since the genesis schema, but never
exposed through a Pydantic schema, an endpoint or the UI. Nothing could write it,
so nothing could read anything back.

First of three sibling revisions that each drop exactly one unused column
(`f7b5c2e93a41` → `0c9e4a17d5b2` → `1d8f5b26e6c3`), so a single
`alembic downgrade -1` restores one column rather than all three.

**Rollback:** `downgrade()` restores the column's type and nullability, not its
contents. That is a non-issue here specifically — the column was unreachable, so
any values it held were never set by the app.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'f7b5c2e93a41'
down_revision: str | None = 'e6a4d81c37b2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column('pitch_contacts', 'role_in_pitch')


def downgrade() -> None:
    op.add_column(
        'pitch_contacts', sa.Column('role_in_pitch', sa.String(length=255), nullable=True)
    )
