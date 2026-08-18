"""drop contacts.last_contacted

Revision ID: 0c9e4a17d5b2
Revises: f7b5c2e93a41
Create Date: 2026-08-17 00:00:00.000000

`last_contacted` had no way to stay accurate. The app neither reads mail nor
observes contact happening, so the date could only ever be maintained by hand —
which made it a field that looked authoritative while being arbitrarily stale.
Removed rather than left to mislead.

Second of three sibling revisions that each drop exactly one unused column
(`f7b5c2e93a41` → `0c9e4a17d5b2` → `1d8f5b26e6c3`), so a single
`alembic downgrade -1` restores one column rather than all three.

**Rollback is lossy.** `downgrade()` restores the column as `DATE NULL`; every
date the upgrade dropped is gone and the rows come back NULL. To recover values,
restore from the pre-migration backup / PITR window rather than downgrading
(production is on the backed-up HA tier — see `sop/instances/rozetta-pms.md`).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0c9e4a17d5b2'
down_revision: str | None = 'f7b5c2e93a41'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column('contacts', 'last_contacted')


def downgrade() -> None:
    # Shape only — the dropped dates are not recoverable here.
    op.add_column('contacts', sa.Column('last_contacted', sa.Date(), nullable=True))
