// Stub for @hello-pangea/dnd used in tests (package is not installed as a dev dep)
export const Droppable = ({ children }) =>
  children(
    { innerRef: () => {}, droppableProps: {}, placeholder: null },
    { isDraggingOver: false }
  )

export const Draggable = ({ children, draggableId }) =>
  children(
    { innerRef: () => {}, draggableProps: { 'data-id': draggableId }, dragHandleProps: {} },
    { isDragging: false }
  )

export const DragDropContext = ({ children }) => children
