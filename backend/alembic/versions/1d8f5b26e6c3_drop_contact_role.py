"""drop contacts.role

Revision ID: 1d8f5b26e6c3
Revises: 0c9e4a17d5b2
Create Date: 2026-08-17 00:00:00.000000

`role` (a contact's job title) was reachable — a field on the Contacts page, a
searched column, and a column in the contacts CSV export — but was never populated
in practice, so it cost a column of screen width and a search term for nothing.

Last of three sibling revisions that each drop exactly one unused column
(`f7b5c2e93a41` → `0c9e4a17d5b2` → `1d8f5b26e6c3`), so a single
`alembic downgrade -1` restores one column rather than all three. This is the
revision at head, so `downgrade -1` from head brings back `role` alone.

**Rollback is lossy.** `downgrade()` restores the column as `VARCHAR(255) NULL`;
any job titles the upgrade dropped are gone and the rows come back NULL. To
recover values, restore from the pre-migration backup / PITR window rather than
downgrading (production is on the backed-up HA tier — see
`sop/instances/rozetta-pms.md`).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '1d8f5b26e6c3'
down_revision: str | None = '0c9e4a17d5b2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column('contacts', 'role')


def downgrade() -> None:
    # Shape only — the dropped job titles are not recoverable here.
    op.add_column('contacts', sa.Column('role', sa.String(length=255), nullable=True))
