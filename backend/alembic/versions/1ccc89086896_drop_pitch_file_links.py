"""drop pitch_file_links

Revision ID: 1ccc89086896
Revises: d2f9a4c17e83
Create Date: 2026-09-29 12:13:59.549941

Destructive. Linked files stored a typed-in path to a file kept somewhere else;
pitch attachments store the file itself and are what the contract covers. See
docs/adr/0002-remove-pitch-file-links.md.

Safe to run because the code that reached this table — the endpoints, the
schemas and the ORM relationship that cascaded pitch deletes into it — was
removed in an earlier deploy, and because both environments held zero rows when
the drop was written. Checked, not assumed: there was no DELETE endpoint, so
every path ever entered was still present.

The downgrade recreates the table empty. It restores shape, not contents, which
is what keeps `downgrade -1` usable from the revisions stacked above this one.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '1ccc89086896'
down_revision: str | None = 'd2f9a4c17e83'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table('pitch_file_links')


def downgrade() -> None:
    op.create_table(
        'pitch_file_links',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('pitch_id', sa.Uuid(), nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=False),
        sa.Column('label', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['pitch_id'], ['pitches.id']),
        sa.PrimaryKeyConstraint('id'),
    )
