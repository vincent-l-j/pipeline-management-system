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

  async function handleDragEnd(result) {
    const { draggableId, source, destination } = result

    // Dropped outside a column, or back in the same spot
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const newStage = destination.droppableId

    // Optimistically update the UI (move the card immediately)
    onPitchMoved(draggableId, newStage)

    // Tell the backend about the stage change
    try {
      await api.post(`/pitches/${draggableId}/stage`, {
        new_stage: newStage,
        note: `Moved from ${source.droppableId.replace('_', ' ')} to ${newStage.replace('_', ' ')}`,
      })
    } catch (err) {
      // If the API call fails, revert the move
      onPitchMoved(draggableId, source.droppableId)
      console.error('Failed to update stage:', err)
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
        {PIPELINE_STAGES.map(stage => (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            pitches={pitchesByStage[stage.key]}
          />
        ))}
      </div>
    </DragDropContext>
  )
}
