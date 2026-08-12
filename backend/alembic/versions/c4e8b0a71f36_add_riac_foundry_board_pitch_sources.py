"""add RIAC, Foundry, Board and RIAC student to pitchsource

Revision ID: c4e8b0a71f36
Revises: b7c3f1d29e84
Create Date: 2026-08-12 00:00:00.000000

Additive enum change: the five original labels keep their positions, so existing
`pitches.source` values are untouched.

The downgrade is only safe while no row uses a new label — Postgres cannot drop a
label that is still referenced. Rows on a new source are reset to NULL first,
which loses that source; `source` is nullable, so NULL is the existing
"not recorded" representation rather than a new state.
"""

from collections.abc import Sequence

from alembic import op

revision: str = 'c4e8b0a71f36'
down_revision: str | None = 'b7c3f1d29e84'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_VALUES = ['REFERRAL', 'WEBSITE', 'EVENT', 'COLD_OUTREACH', 'INTERNAL']
NEW_VALUES = [*OLD_VALUES, 'RIAC', 'FOUNDRY', 'BOARD', 'RIAC_STUDENT']
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
