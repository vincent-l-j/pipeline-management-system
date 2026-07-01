/**
 * The full Kanban pipeline board.
 * Displays all pipeline stages as columns, with pitch cards that can be
 * dragged between columns to change their stage.
 */

import { DragDropContext } from '@hello-pangea/dnd'
import KanbanColumn from './KanbanColumn'
import { PIPELINE_STAGES } from './PipelineConfig'
import api from '../../services/api'

export default function KanbanBoard({ pitches, onPitchMoved }) {
  // Group pitches by their current stage
  const pitchesByStage = {}
  for (const stage of PIPELINE_STAGES) {
    pitchesByStage[stage.key] = pitches.filter(p => p.current_stage === stage.key)
  }

  // Shared optimistic-move path used by both drag-and-drop and the right-click
  // stage menu: move the card immediately, persist the change, revert on failure.
  async function moveStage(pitchId, fromStage, toStage) {
    if (fromStage === toStage) return

    onPitchMoved(pitchId, toStage)

    try {
      await api.post(`/pitches/${pitchId}/stage`, {
        new_stage: toStage,
        note: `Moved from ${fromStage.replace('_', ' ')} to ${toStage.replace('_', ' ')}`,
      })
    } catch (err) {
      // If the API call fails, revert the move
      onPitchMoved(pitchId, fromStage)
      console.error('Failed to update stage:', err)
    }
  }

  function handleDragEnd(result) {
    const { draggableId, source, destination } = result

    // Dropped outside a column, or back in the same spot
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    moveStage(draggableId, source.droppableId, destination.droppableId)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
        {PIPELINE_STAGES.map(stage => (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            pitches={pitchesByStage[stage.key]}
            onStageSelect={moveStage}
          />
        ))}
      </div>
    </DragDropContext>
  )
}
