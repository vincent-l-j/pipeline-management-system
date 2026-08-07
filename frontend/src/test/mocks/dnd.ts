import { ReactNode } from 'react'

interface DroppableProvided {
  innerRef: (element: HTMLElement | null) => void
  droppableProps: any
  placeholder: null
}

interface DroppableSnapshot {
  isDraggingOver: boolean
}

interface DroppableProps {
  children: (provided: DroppableProvided, snapshot: DroppableSnapshot) => ReactNode
  droppableId: string
}

export const Droppable = ({ children }: DroppableProps) =>
  children(
    { innerRef: () => {}, droppableProps: {}, placeholder: null },
    { isDraggingOver: false }
  )

interface DraggableProvided {
  innerRef: (element: HTMLElement | null) => void
  draggableProps: Record<string, string>
  dragHandleProps: any
}

interface DraggableSnapshot {
  isDragging: boolean
}

interface DraggableProps {
  children: (provided: DraggableProvided, snapshot: DraggableSnapshot) => ReactNode
  draggableId: string
  index: number
}

export const Draggable = ({ children, draggableId }: DraggableProps) =>
  children(
    { innerRef: () => {}, draggableProps: { 'data-id': draggableId }, dragHandleProps: {} },
    { isDragging: false }
  )

interface DragDropContextProps {
  children: ReactNode
  onDragEnd?: (result: any) => void
}

export const DragDropContext = ({ children }: DragDropContextProps) => children
