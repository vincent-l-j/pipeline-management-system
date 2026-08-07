import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import KanbanColumn from '../KanbanColumn'

// Mock the drag-and-drop library
vi.mock('@hello-pangea/dnd', () => ({
  Droppable: ({ children }: { children: (provided: any, snapshot: any) => any }) =>
    children(
      { innerRef: () => {}, droppableProps: {}, placeholder: null },
      { isDraggingOver: false }
    ),
  Draggable: ({ children }: { children: (provided: any, snapshot: any) => any }) =>
    children(
      { innerRef: () => {}, draggableProps: {}, dragHandleProps: {} },
      { isDragging: false }
    ),
}))

// Mock useNavigate and useAuth
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...mod,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'viewer' } }),
}))

vi.mock('../PipelineConfig', () => ({
  STAGE_MAP: {},
  SOURCE_LABELS: {},
  FUNDING_LABELS: {},
  PIPELINE_STAGES: [],
}))

describe('KanbanColumn', () => {
  it('renders column with title', () => {
    const stage = { key: 'received', label: 'Received', color: 'bg-blue-400' }
    render(<KanbanColumn stage={stage} pitches={[]} />)
    expect(screen.getByText('Received')).toBeInTheDocument()
  })

  it('renders pitch cards', () => {
    const stage = { key: 'received', label: 'Received', color: 'bg-blue-400' }
    const pitches = [{ id: 1, title: 'Test Pitch', current_stage: 'received' }]
    render(<KanbanColumn stage={stage} pitches={pitches} />)
    expect(screen.getByText('Test Pitch')).toBeInTheDocument()
  })
})
