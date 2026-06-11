import { render, screen } from '@testing-library/react'
import KanbanBoard from '../KanbanBoard'
import { PIPELINE_STAGES } from '../PipelineConfig'

// @hello-pangea/dnd is aliased to a stub in vitest.config.js.
// Mock KanbanColumn to inspect which pitches land in which stage.
vi.mock('../KanbanColumn', () => ({
  default: ({ stage, pitches }) => (
    <div data-testid="column" data-stage={stage.key}>
      <span>{stage.label}</span>
      <span data-testid="count">{pitches.length}</span>
      {pitches.map(p => (
        <span key={p.id} data-testid={`pitch-${stage.key}`}>{p.title}</span>
      ))}
    </div>
  ),
}))

const pitches = [
  { id: 'a', title: 'Alpha', current_stage: 'received' },
  { id: 'b', title: 'Beta', current_stage: 'received' },
  { id: 'c', title: 'Gamma', current_stage: 'due_diligence' },
]

describe('KanbanBoard', () => {
  it('renders one column per pipeline stage', () => {
    render(<KanbanBoard pitches={[]} onPitchMoved={vi.fn()} />)
    expect(screen.getAllByTestId('column')).toHaveLength(PIPELINE_STAGES.length)
  })

  it('renders columns in the configured stage order', () => {
    render(<KanbanBoard pitches={[]} onPitchMoved={vi.fn()} />)
    const order = screen.getAllByTestId('column').map(c => c.getAttribute('data-stage'))
    expect(order).toEqual(PIPELINE_STAGES.map(s => s.key))
  })

  it('groups each pitch into the column matching its current_stage', () => {
    render(<KanbanBoard pitches={pitches} onPitchMoved={vi.fn()} />)
    expect(screen.getAllByTestId('pitch-received').map(n => n.textContent)).toEqual(['Alpha', 'Beta'])
    expect(screen.getAllByTestId('pitch-due_diligence').map(n => n.textContent)).toEqual(['Gamma'])
  })

  it('passes empty pitch arrays to stages with no matching pitches', () => {
    render(<KanbanBoard pitches={pitches} onPitchMoved={vi.fn()} />)
    const parkedColumn = screen
      .getAllByTestId('column')
      .find(c => c.getAttribute('data-stage') === 'parked')
    expect(parkedColumn.querySelector('[data-testid="count"]').textContent).toBe('0')
  })

  it('ignores pitches with an unknown stage (renders no extra columns)', () => {
    render(
      <KanbanBoard
        pitches={[{ id: 'x', title: 'Orphan', current_stage: 'nonexistent' }]}
        onPitchMoved={vi.fn()}
      />
    )
    expect(screen.getAllByTestId('column')).toHaveLength(PIPELINE_STAGES.length)
    expect(screen.queryByText('Orphan')).not.toBeInTheDocument()
  })
})
