import { ReactNode } from "react";

interface DroppableProvided {
  innerRef: (element: HTMLElement | null) => void;
  droppableProps: Record<string, unknown>;
  placeholder: null;
}

interface DroppableSnapshot {
  isDraggingOver: boolean;
}

interface DroppableProps {
  children: (
    provided: DroppableProvided,
    snapshot: DroppableSnapshot,
  ) => ReactNode;
  droppableId: string;
}

export const Droppable = ({ children }: DroppableProps) =>
  children(
    {
      innerRef: (_element: HTMLElement | null) => {},
      droppableProps: {},
      placeholder: null,
    },
    { isDraggingOver: false },
  );

interface DraggableProvided {
  innerRef: (element: HTMLElement | null) => void;
  draggableProps: Record<string, string>;
  dragHandleProps: Record<string, unknown>;
}

interface DraggableSnapshot {
  isDragging: boolean;
}

interface DraggableProps {
  children: (
    provided: DraggableProvided,
    snapshot: DraggableSnapshot,
  ) => ReactNode;
  draggableId: string;
  index: number;
}

export const Draggable = ({ children, draggableId }: DraggableProps) =>
  children(
    {
      innerRef: (_element: HTMLElement | null) => {},
      draggableProps: { "data-id": draggableId },
      dragHandleProps: {},
    },
    { isDragging: false },
  );

interface DragDropContextProps {
  children: ReactNode;
  onDragEnd?: (result: Record<string, unknown>) => void;
}

export const DragDropContext = ({ children }: DragDropContextProps) => children;
