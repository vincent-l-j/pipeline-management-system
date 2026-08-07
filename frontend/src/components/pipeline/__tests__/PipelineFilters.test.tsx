import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PipelineFilters from '../PipelineFilters'

vi.mock('../PipelineConfig', () => ({
  PIPELINE_STAGES: [
    { key: 'received', label: 'Received', color: 'bg-blue-400' },
    { key: 'submitted', label: 'Submitted', color: 'bg-green-400' },
  ],
  SOURCE_LABELS: { partner: 'Partner', internal: 'Internal' },
  FUNDING_LABELS: {},
}))

describe('PipelineFilters', () => {
  it('renders filter controls', () => {
    const onChange = vi.fn()
    render(<PipelineFilters filters={{ sort: 'newest' }} onChange={onChange} users={[]} />)

    expect(screen.getByDisplayValue('All stages')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All sources')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All domains')).toBeInTheDocument()
  })

  it('calls onChange when stage filter changes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PipelineFilters filters={{ sort: 'newest' }} onChange={onChange} users={[]} />)

    const stageSelect = screen.getByDisplayValue('All stages')
    await user.selectOptions(stageSelect, 'received')

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ stage: 'received' }))
  })
})
