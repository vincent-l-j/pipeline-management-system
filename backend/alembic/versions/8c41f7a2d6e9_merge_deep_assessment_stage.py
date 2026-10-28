"""merge the Deep Assessment pipeline stage into Due Diligence

Revision ID: 8c41f7a2d6e9
Revises: 5b2e9d14c7a3
Create Date: 2026-10-28 00:00:00.000000

Users couldn't tell Deep Assessment from Due Diligence, so Deep Assessment was
retired in the app first, and nothing has written it since. Pitches still in it
move to Due Diligence, and stage history is rewritten the same way. A history row
that mentioned Deep Assessment and would then record a move from a stage to the
same stage is deleted, because it no longer records a change; a same-stage row
that never mentioned Deep Assessment is kept. Both stages count as "advanced to
assessment", so that figure is the same either side of the change.

**Rollback is lossy.** `downgrade()` puts DEEP_ASSESSMENT back into the type, but
not the data: which pitches were in Deep Assessment, and the deleted history rows,
can't be recomputed. To recover them, restore from the pre-migration backup / PITR
window and redeploy the previous commit, which takes longer than the five minutes a
redeploy does (production is on the backed-up HA tier — see
`sop/instances/rozetta-pms.md`).
"""

from collections.abc import Sequence

from alembic import op

revision: str = '8c41f7a2d6e9'
down_revision: str | None = '5b2e9d14c7a3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_VALUES = [
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
NEW_VALUES = [value for value in OLD_VALUES if value != 'DEEP_ASSESSMENT']
STAGE_COLUMNS = [
    ('pitches', 'current_stage'),
    ('pitch_stage_history', 'from_stage'),
    ('pitch_stage_history', 'to_stage'),
]


def upgrade() -> None:
    op.execute(
        "UPDATE pitches SET current_stage = 'DUE_DILIGENCE'"
        " WHERE current_stage = 'DEEP_ASSESSMENT'"
    )
    # Before the remap, while the rows that mentioned Deep Assessment can still be
    # told apart from same-stage rows that never did.
    op.execute(
        "DELETE FROM pitch_stage_history"
        " WHERE (from_stage = 'DEEP_ASSESSMENT'"
        " AND to_stage IN ('DEEP_ASSESSMENT', 'DUE_DILIGENCE'))"
        " OR (from_stage = 'DUE_DILIGENCE' AND to_stage = 'DEEP_ASSESSMENT')"
    )
    op.execute(
        "UPDATE pitch_stage_history SET from_stage = 'DUE_DILIGENCE'"
        " WHERE from_stage = 'DEEP_ASSESSMENT'"
    )
    op.execute(
        "UPDATE pitch_stage_history SET to_stage = 'DUE_DILIGENCE'"
        " WHERE to_stage = 'DEEP_ASSESSMENT'"
    )
    op.sync_enum_values(
        'public', 'pipelinestage', NEW_VALUES, STAGE_COLUMNS, enum_values_to_rename=[]
    )


def downgrade() -> None:
    op.sync_enum_values(
        'public', 'pipelinestage', OLD_VALUES, STAGE_COLUMNS, enum_values_to_rename=[]
    )
