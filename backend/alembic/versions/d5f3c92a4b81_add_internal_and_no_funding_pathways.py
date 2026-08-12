"""add no_funding_identified and internal_funding to fundingpathway

Revision ID: d5f3c92a4b81
Revises: c4e8b0a71f36
Create Date: 2026-08-12 00:00:00.000000

Additive enum change: the six original labels keep their positions, so existing
`pitches.funding_pathway` values are untouched.

The downgrade is only safe while no row uses a new label — Postgres cannot drop a
label that is still referenced. Rows on a new pathway are reset to NULL first,
which loses that pathway; `funding_pathway` is nullable, so NULL is the existing
"not recorded" representation rather than a new state. Note NO_FUNDING_IDENTIFIED
degrades to the same NULL as "never recorded", which are different facts.
"""

from collections.abc import Sequence

from alembic import op

revision: str = 'd5f3c92a4b81'
down_revision: str | None = 'c4e8b0a71f36'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_VALUES = ['CRC_BID', 'RDTI', 'PHILANTHROPIC', 'GOVERNMENT_GRANT', 'PRIVATE', 'OTHER']
NEW_VALUES = [*OLD_VALUES, 'NO_FUNDING_IDENTIFIED', 'INTERNAL_FUNDING']
ADDED_VALUES = NEW_VALUES[len(OLD_VALUES) :]


def upgrade() -> None:
    op.sync_enum_values(
        'public',
        'fundingpathway',
        NEW_VALUES,
        [('pitches', 'funding_pathway')],
        enum_values_to_rename=[],
    )


def downgrade() -> None:
    added = ', '.join(f"'{value}'" for value in ADDED_VALUES)
    op.execute(f"UPDATE pitches SET funding_pathway = NULL WHERE funding_pathway::text IN ({added})")
    op.sync_enum_values(
        'public',
        'fundingpathway',
        OLD_VALUES,
        [('pitches', 'funding_pathway')],
        enum_values_to_rename=[],
    )
