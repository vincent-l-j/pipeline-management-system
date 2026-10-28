"""drop the Received pipeline stage

Revision ID: 5b2e9d14c7a3
Revises: 1ccc89086896
Create Date: 2026-10-28 00:00:00.000000

Received was retired in the app first, so nothing has written it since. Pitches
still in it move to Initial Screen, where work actually starts, and stage history
is rewritten the same way. A history row that mentioned Received and would then
record a move from a stage to the same stage is deleted, because it no longer
records a change; a same-stage row that never mentioned Received is kept.

**Rollback is lossy.** `downgrade()` puts RECEIVED back into the type, but not the
data: which pitches were in Received, and the deleted history rows, can't be
recomputed. To recover them, restore from the pre-migration backup / PITR window and
redeploy the previous commit, which takes longer than the five minutes a redeploy
does (production is on the backed-up HA tier — see `sop/instances/rozetta-pms.md`).
"""

from collections.abc import Sequence

from alembic import op

revision: str = '5b2e9d14c7a3'
down_revision: str | None = '1ccc89086896'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_VALUES = [
    'RECEIVED',
    'INITIAL_SCREEN',
    'DISCOVERY_MEETING',
    'DEEP_ASSESSMENT',
    'DUE_DILIGENCE',
    'DECISION_PENDING',
    'ACTIVE_SUPPORT',
    'PARKED',
    'DECLINED',
    'COMPLETED',
]
NEW_VALUES = [value for value in OLD_VALUES if value != 'RECEIVED']
STAGE_COLUMNS = [
    ('pitches', 'current_stage'),
    ('pitch_stage_history', 'from_stage'),
    ('pitch_stage_history', 'to_stage'),
]


def upgrade() -> None:
    op.execute(
        "UPDATE pitches SET current_stage = 'INITIAL_SCREEN' WHERE current_stage = 'RECEIVED'"
    )
    # Before the remap, while the rows that mentioned Received can still be told
    # apart from same-stage rows that never did.
    op.execute(
        "DELETE FROM pitch_stage_history"
        " WHERE (from_stage = 'RECEIVED' AND to_stage IN ('RECEIVED', 'INITIAL_SCREEN'))"
        " OR (from_stage = 'INITIAL_SCREEN' AND to_stage = 'RECEIVED')"
    )
    op.execute(
        "UPDATE pitch_stage_history SET from_stage = 'INITIAL_SCREEN'"
        " WHERE from_stage = 'RECEIVED'"
    )
    op.execute(
        "UPDATE pitch_stage_history SET to_stage = 'INITIAL_SCREEN' WHERE to_stage = 'RECEIVED'"
    )
    op.sync_enum_values(
        'public', 'pipelinestage', NEW_VALUES, STAGE_COLUMNS, enum_values_to_rename=[]
    )


def downgrade() -> None:
    op.sync_enum_values(
        'public', 'pipelinestage', OLD_VALUES, STAGE_COLUMNS, enum_values_to_rename=[]
    )
