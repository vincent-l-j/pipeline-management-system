"""add next_step to pitches

Revision ID: f3c8d1e5b072
Revises: a3d7e5c81b40
Create Date: 2026-08-13 00:00:00.000000

Plain additive change: a nullable Text column, so it needs no default and no
backfill, and existing rows read as NULL ("no next step recorded").

The downgrade drops the column and with it whatever notes were typed into it.
That text exists nowhere else, so a downgrade after any use loses it — nothing
else depends on the column, so the drop itself is safe.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'f3c8d1e5b072'
down_revision: str | None = 'a3d7e5c81b40'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('pitches', sa.Column('next_step', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('pitches', 'next_step')
