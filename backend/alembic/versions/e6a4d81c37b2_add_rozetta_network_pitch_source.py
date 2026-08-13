"""add Rozetta network to pitchsource

Revision ID: e6a4d81c37b2
Revises: d5f3c92a4b81
Create Date: 2026-08-13 00:00:00.000000

Additive enum change: the nine existing labels keep their positions, so existing
`pitches.source` values are untouched.

The downgrade is only safe while no row uses the new label — Postgres cannot drop
a label that is still referenced. Rows on the new source are reset to NULL first,
which loses that source; `source` is nullable, so NULL is the existing
"not recorded" representation rather than a new state.
"""

from collections.abc import Sequence

from alembic import op

revision: str = 'e6a4d81c37b2'
down_revision: str | None = 'd5f3c92a4b81'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_VALUES = [
    'REFERRAL',
    'WEBSITE',
    'EVENT',
    'COLD_OUTREACH',
    'INTERNAL',
    'RIAC',
    'FOUNDRY',
    'BOARD',
    'RIAC_STUDENT',
]
NEW_VALUES = [*OLD_VALUES, 'ROZETTA_NETWORK']
ADDED_VALUES = NEW_VALUES[len(OLD_VALUES) :]


def upgrade() -> None:
    op.sync_enum_values(
        'public',
        'pitchsource',
        NEW_VALUES,
        [('pitches', 'source')],
        enum_values_to_rename=[],
    )


def downgrade() -> None:
    added = ', '.join(f"'{value}'" for value in ADDED_VALUES)
    op.execute(f"UPDATE pitches SET source = NULL WHERE source::text IN ({added})")
    op.sync_enum_values(
        'public',
        'pitchsource',
        OLD_VALUES,
        [('pitches', 'source')],
        enum_values_to_rename=[],
    )
