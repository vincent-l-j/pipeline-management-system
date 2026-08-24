"""add request_type to pitches

Revision ID: b4c1e7a02f58
Revises: a8d2f61c94e3
Create Date: 2026-08-21 00:00:00.000000

A new Postgres type rather than labels added to an existing one, so this is a
plain create + add_column and not an op.sync_enum_values call.

The downgrade drops the column *and* the type. Autogenerate routinely omits the
second half, which leaves an orphaned requesttype behind and makes the next
upgrade fail with "type already exists".
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b4c1e7a02f58'
down_revision: str | None = 'a8d2f61c94e3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Postgres stores the enum's *names*, matching how SQLAlchemy maps the other
# enum columns in this schema (see the pitchsource migrations).
REQUEST_TYPE = sa.Enum(
    'ADVISE',
    'CONVENE',
    'SPONSORED_RESEARCH',
    'THOUGHT_LEADERSHIP',
    'CATALYSE',
    'DIRECT_INVESTMENT',
    'OTHER',
    name='requesttype',
)


def upgrade() -> None:
    REQUEST_TYPE.create(op.get_bind(), checkfirst=True)
    op.add_column('pitches', sa.Column('request_type', REQUEST_TYPE, nullable=True))


def downgrade() -> None:
    op.drop_column('pitches', 'request_type')
    REQUEST_TYPE.drop(op.get_bind(), checkfirst=True)
