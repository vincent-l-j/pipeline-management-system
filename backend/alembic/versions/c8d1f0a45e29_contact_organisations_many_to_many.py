"""move contacts.organisation_id into a contact_organisations join table

Revision ID: c8d1f0a45e29
Revises: 1d8f5b26e6c3
Create Date: 2026-08-18 00:00:00.000000

A contact could previously belong to at most one organisation, which forced a
choice for the people who genuinely sit across several — an academic with a
university post and a startup role, a consultant advising three companies. The
single FK becomes a join table where every affiliation is equal; there is no
primary organisation.

Data-migrating revision: each contact with a non-NULL `organisation_id` gets one
join row before the column is dropped, so no existing affiliation is lost.

**Rollback is lossy.** A contact may now hold several affiliations and the
restored column holds one. `downgrade()` keeps the organisation whose name sorts
first (ties broken by id, so the result is deterministic and a re-applied
`upgrade()` is stable) and discards the rest. To recover the discarded links,
restore from the pre-migration backup / PITR window rather than downgrading
(production is on the backed-up HA tier — see `sop/instances/rozetta-pms.md`).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'c8d1f0a45e29'
down_revision: str | None = '1d8f5b26e6c3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('contact_organisations',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('contact_id', sa.Uuid(), nullable=False),
    sa.Column('organisation_id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['contact_id'], ['contacts.id'], ),
    sa.ForeignKeyConstraint(['organisation_id'], ['organisations.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    op.execute(
        """
        INSERT INTO contact_organisations (id, contact_id, organisation_id)
        SELECT gen_random_uuid(), id, organisation_id
          FROM contacts
         WHERE organisation_id IS NOT NULL
        """
    )

    op.drop_column('contacts', 'organisation_id')


def downgrade() -> None:
    op.add_column('contacts', sa.Column('organisation_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'contacts_organisation_id_fkey', 'contacts', 'organisations', ['organisation_id'], ['id']
    )

    # One affiliation survives per contact — see the lossiness note above.
    op.execute(
        """
        UPDATE contacts c
           SET organisation_id = (
               SELECT co.organisation_id
                 FROM contact_organisations co
                 JOIN organisations o ON o.id = co.organisation_id
                WHERE co.contact_id = c.id
                ORDER BY o.name, co.organisation_id
                LIMIT 1
           )
        """
    )

    op.drop_table('contact_organisations')
