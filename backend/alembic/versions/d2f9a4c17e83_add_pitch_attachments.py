"""add pitch_attachments

Revision ID: d2f9a4c17e83
Revises: b4c1e7a02f58
Create Date: 2026-09-03 00:00:00.000000

Plain additive change: a new table holding a pointer to each file a pitch has in
the document library — the store's item id, a display name, a content type, a
size and an uploader. No bytes, so the table stays small and the library remains
the system of record for content.

The `pitch_id` foreign key carries no `ondelete`. A pitch's attachment rows are
removed by the ORM cascade on `Pitch.attachments`, which the SQLite unit suite
exercises; a database cascade would be untested there and only observed in
production. `uploaded_by_id` is nullable so a removed user doesn't take their
uploads with them.

The downgrade drops the table. That loses every pointer, and the files it named
stay in the document library with nothing in the app referring to them — they
are found by browsing the pitch's folder, which is why the folder is keyed by the
pitch id. The documents themselves are never destroyed by this migration.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'd2f9a4c17e83'
down_revision: str | None = 'b4c1e7a02f58'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'pitch_attachments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('pitch_id', sa.Uuid(), nullable=False),
        sa.Column('store_item_id', sa.String(length=255), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=255), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('uploaded_by_id', sa.Uuid(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['pitch_id'], ['pitches.id'], ),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_pitch_attachments_pitch_id'), 'pitch_attachments', ['pitch_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_pitch_attachments_pitch_id'), table_name='pitch_attachments')
    op.drop_table('pitch_attachments')
