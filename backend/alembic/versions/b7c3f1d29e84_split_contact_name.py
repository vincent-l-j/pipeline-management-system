"""split contacts.name into first_name / last_name

Revision ID: b7c3f1d29e84
Revises: a1a27441d35c
Create Date: 2026-08-11 00:00:00.000000

Data-migrating revision: `name` is split on its first whitespace run — everything
before it becomes `first_name`, the remainder `last_name` (NULL for a single-token
name). Autogenerate would have emitted this as drop + add, destroying the names.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b7c3f1d29e84'
down_revision: str | None = 'a1a27441d35c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('contacts', sa.Column('first_name', sa.String(length=255), nullable=True))
    op.add_column('contacts', sa.Column('last_name', sa.String(length=255), nullable=True))

    op.execute(
        """
        UPDATE contacts
           SET first_name = split_part(btrim(name), ' ', 1),
               last_name = NULLIF(
                   btrim(
                       substr(btrim(name), length(split_part(btrim(name), ' ', 1)) + 1)
                   ),
                   ''
               )
        """
    )

    op.alter_column('contacts', 'first_name', nullable=False)
    op.create_index(op.f('ix_contacts_first_name'), 'contacts', ['first_name'], unique=False)
    op.create_index(op.f('ix_contacts_last_name'), 'contacts', ['last_name'], unique=False)
    op.drop_index(op.f('ix_contacts_name'), table_name='contacts')
    op.drop_column('contacts', 'name')


def downgrade() -> None:
    # Recombining is lossy for a first_name that itself contains a space: a
    # re-applied upgrade would split it at a different point.
    op.add_column('contacts', sa.Column('name', sa.String(length=255), nullable=True))
    op.execute(
        "UPDATE contacts SET name = btrim(first_name || ' ' || coalesce(last_name, ''))"
    )
    op.alter_column('contacts', 'name', nullable=False)
    op.create_index(op.f('ix_contacts_name'), 'contacts', ['name'], unique=False)
    op.drop_index(op.f('ix_contacts_last_name'), table_name='contacts')
    op.drop_index(op.f('ix_contacts_first_name'), table_name='contacts')
    op.drop_column('contacts', 'last_name')
    op.drop_column('contacts', 'first_name')
