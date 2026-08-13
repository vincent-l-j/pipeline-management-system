"""add decline_reason to assessments

Revision ID: a8d2f61c94e3
Revises: f3c8d1e5b072
Create Date: 2026-08-13 00:00:00.000000

Unlike the last few enum migrations, this one creates a NEW Postgres type rather
than adding labels to an existing one, so it is a plain create + add_column and
not an op.sync_enum_values call.

The downgrade drops the column *and* the type. Autogenerate routinely omits the
second half, which leaves an orphaned declinereason type behind and makes the
next upgrade fail with "type already exists".
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'a8d2f61c94e3'
down_revision: str | None = 'f3c8d1e5b072'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Postgres stores the enum's *names*, matching how SQLAlchemy maps the other
# enum columns in this schema (see the pitchsource migrations).
DECLINE_REASON = sa.Enum(
    'NOT_STRATEGIC_PRIORITY',
    'INSUFFICIENT_SCALE',
    'INSUFFICIENT_CAPACITY_CAPABILITY',
    'GRANT_FUNDING_REJECTED',
    'LACK_OF_ROZETTA_CAPACITY',
    'OTHER',
    name='declinereason',
)


def upgrade() -> None:
    DECLINE_REASON.create(op.get_bind(), checkfirst=True)
    op.add_column('assessments', sa.Column('decline_reason', DECLINE_REASON, nullable=True))


def downgrade() -> None:
    op.drop_column('assessments', 'decline_reason')
    DECLINE_REASON.drop(op.get_bind(), checkfirst=True)
