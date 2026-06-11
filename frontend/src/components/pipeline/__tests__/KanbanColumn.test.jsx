import { render, screen } from '@testing-library/react'
import KanbanColumn from '../KanbanColumn'

// @hello-pangea/dnd is aliased to a stub in vitest.config.js (package not installed)
// Mock PitchCard to isolate KanbanColumn behaviour
vi.mock('../PitchCard', () => ({
  default: ({ pitch }) => <div data-testid="pitch-card">{pitch.title}</div>,
}))

const stage = {
  key: 'deep_assessment',
  label: 'Deep Assessment',
  color: 'bg-teal-500',
}

describe('KanbanColumn', () => {
  it('renders the stage label', () => {
    render(<KanbanColumn stage={stage} pitches={[]} />)
    expect(screen.getByText('Deep Assessment')).toBeInTheDocument()
  })

  it('shows pitch count of 0 in header badge', () => {
    render(<KanbanColumn stage={stage} pitches={[]} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows the correct pitch count in the header badge', () => {
    const pitches = [
      { id: '1', title: 'Pitch One' },
      { id: '2', title: 'Pitch Two' },
    ]
    render(<KanbanColumn stage={stage} pitches={pitches} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders a PitchCard for each pitch', () => {
    const pitches = [
      { id: '1', title: 'Alpha Venture' },
      { id: '2', title: 'Beta Project' },
    ]
    render(<KanbanColumn stage={stage} pitches={pitches} />)
    expect(screen.getAllByTestId('pitch-card')).toHaveLength(2)
    expect(screen.getByText('Alpha Venture')).toBeInTheDocument()
    expect(screen.getByText('Beta Project')).toBeInTheDocument()
  })

  it('shows "No pitches" message when the column is empty', () => {
    render(<KanbanColumn stage={stage} pitches={[]} />)
    expect(screen.getByText('No pitches')).toBeInTheDocument()
  })

  it('does not show "No pitches" message when pitches are present', () => {
    render(<KanbanColumn stage={stage} pitches={[{ id: '1', title: 'X' }]} />)
    expect(screen.queryByText('No pitches')).not.toBeInTheDocument()
  })
})
