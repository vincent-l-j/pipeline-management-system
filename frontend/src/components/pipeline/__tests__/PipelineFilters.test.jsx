import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PipelineFilters from '../PipelineFilters'
import { PIPELINE_STAGES, SOURCE_LABELS } from '../PipelineConfig'

const mockUsers = [
  { id: 'u1', display_name: 'Alice Lead' },
  { id: 'u2', display_name: 'Bob Lead' },
]

function renderFilters(filters = {}, onChange = vi.fn()) {
  render(<PipelineFilters filters={filters} onChange={onChange} users={mockUsers} />)
  return onChange
}

describe('PipelineFilters', () => {
  it('renders all five select controls', () => {
    renderFilters()
    expect(screen.getAllByRole('combobox')).toHaveLength(5)
  })

  it('renders an option for every pipeline stage', () => {
    renderFilters()
    for (const stage of PIPELINE_STAGES) {
      expect(screen.getByRole('option', { name: stage.label })).toBeInTheDocument()
    }
  })

  it('renders an option for every source label', () => {
    renderFilters()
    for (const label of Object.values(SOURCE_LABELS)) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument()
    }
  })

  it('populates the lead select with users', () => {
    renderFilters()
    expect(screen.getByRole('option', { name: 'Alice Lead' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bob Lead' })).toBeInTheDocument()
  })

  it('defaults the sort select to "Newest first" when no sort is set', () => {
    renderFilters()
    expect(screen.getByRole('option', { name: 'Newest first' }).selected).toBe(true)
  })

  it('reflects the current stage filter value', () => {
    renderFilters({ stage: 'due_diligence' })
    expect(screen.getByRole('option', { name: 'Due Diligence' }).selected).toBe(true)
  })

  it('calls onChange with the updated stage, preserving other filters', async () => {
    const user = userEvent.setup()
    const onChange = renderFilters({ source: 'website' })
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'received')
    expect(onChange).toHaveBeenCalledWith({ source: 'website', stage: 'received' })
  })

  it('calls onChange when the sort option changes', async () => {
    const user = userEvent.setup()
    const onChange = renderFilters()
    // sort is the 5th combobox
    await user.selectOptions(screen.getAllByRole('combobox')[4], 'oldest')
    expect(onChange).toHaveBeenCalledWith({ sort: 'oldest' })
  })

  it('does not show the Clear filters button when no filters are active', () => {
    renderFilters()
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()
  })

  it('shows the Clear filters button when a filter is active', () => {
    renderFilters({ stage: 'parked' })
    expect(screen.getByText('Clear filters')).toBeInTheDocument()
  })

  it('clears filters but keeps the sort when Clear filters is clicked', async () => {
    const user = userEvent.setup()
    const onChange = renderFilters({ stage: 'parked', source: 'event', sort: 'oldest' })
    await user.click(screen.getByText('Clear filters'))
    expect(onChange).toHaveBeenCalledWith({ sort: 'oldest' })
  })

  it('renders an empty lead select gracefully when users is empty', () => {
    render(<PipelineFilters filters={{}} onChange={vi.fn()} users={[]} />)
    expect(screen.getByRole('option', { name: 'All leads' })).toBeInTheDocument()
  })
})
