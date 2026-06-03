/**
 * A single column in the Kanban board representing one pipeline stage.
 * Contains a header with stage name + count, and a droppable area for pitch cards.
 */

import { Droppable, Draggable } from '@hello-pangea/dnd'
import PitchCard from './PitchCard'

export default function KanbanColumn({ stage, pitches }) {
  return (
    <div className="flex flex-col bg-navy-50/50 rounded-xl min-w-[260px] w-[260px] max-h-full">
      {/* Column header */}
      <div className="px-3 py-3 flex items-center gap-2 border-b border-navy-100">
        <div className={`w-2 h-2 rounded-full ${stage.color}`} />
        <h3 className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
          {stage.label}
        </h3>
        <span className="ml-auto text-xs font-medium text-navy-400 bg-navy-100 px-1.5 py-0.5 rounded-full">
          {pitches.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 overflow-y-auto min-h-[100px] transition-colors ${
              snapshot.isDraggingOver ? 'bg-navy-100/60' : ''
            }`}
          >
            {pitches.map((pitch, index) => (
              <Draggable key={pitch.id} draggableId={pitch.id} index={index}>
                {(provided, snapshot) => (
                  <PitchCard
                    pitch={pitch}
                    innerRef={provided.innerRef}
                    draggableProps={provided.draggableProps}
                    dragHandleProps={provided.dragHandleProps}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {pitches.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-navy-300 text-center py-4">No pitches</p>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}
