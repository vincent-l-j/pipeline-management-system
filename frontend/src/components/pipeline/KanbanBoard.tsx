/**
 * The full Kanban pipeline board.
 * Displays all pipeline stages as columns, with pitch cards that can be
 * dragged between columns to change their stage.
 */

import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import KanbanColumn from "./KanbanColumn";
import { PIPELINE_STAGES } from "./PipelineConfig";
import { moveStage } from "./moveStage";
import type { Pitch } from "../../types";

interface KanbanBoardProps {
  pitches: Pitch[];
  onPitchMoved: (pitchId: string, newStage: string) => void;
}

export default function KanbanBoard({
  pitches,
  onPitchMoved,
}: KanbanBoardProps) {
  // Group pitches by their current stage
  const pitchesByStage: Record<string, Pitch[]> = {};
  for (const stage of PIPELINE_STAGES) {
    pitchesByStage[stage.key] = pitches.filter(
      (p) => p.current_stage === stage.key,
    );
  }

  function handleDragEnd(result: DropResult): void {
    const { draggableId, source, destination } = result;

    // Dropped outside a column, or back in the same spot
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    void moveStage(
      draggableId,
      source.droppableId,
      destination.droppableId,
      onPitchMoved,
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {/* Paper has no scrollbar, so on paper the columns wrap onto further
          rows instead of running off the page edge, where they are dropped. */}
      <div
        className="flex gap-3 overflow-x-auto pb-4 print:flex-wrap print:overflow-visible"
        style={{ minHeight: "500px" }}
      >
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            pitches={pitchesByStage[stage.key]}
            onStageSelect={(pitchId, fromStage, toStage) => {
              void moveStage(pitchId, fromStage, toStage, onPitchMoved);
            }}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
