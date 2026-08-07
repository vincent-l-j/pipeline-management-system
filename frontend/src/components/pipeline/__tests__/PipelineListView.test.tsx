import { render, screen } from '@testing-library/react'
import PipelineListView from '../PipelineListView'

vi.mock('react-router-dom', async (importOriginal: () => Promise<typeof import('react-router-dom')>) => {
  const mod = await importOriginal()
  return { ...mod, useNavigate: () => vi.fn() }
})

describe('PipelineListView', () => {
  it('renders empty state when no pitches', () => {
    render(<PipelineListView pitches={[]} />)
    expect(screen.getByText(/No pitches/i)).toBeInTheDocument()
  })
})
