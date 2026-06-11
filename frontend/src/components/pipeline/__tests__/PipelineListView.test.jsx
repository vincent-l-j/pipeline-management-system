import { render, screen, within } from '@testing-library/react'
import PipelineListView from '../PipelineListView'

const basePitch = {
  id: 'p1',
  title: 'Climate Sensor Network',
  current_stage: 'due_diligence',
  source: 'referral',
  funding_pathway: 'government_grant',
  domain_tags: 'climate, sensors',
  is_confidential: false,
  short_description: 'A network of low-cost sensors.',
  submission_date: '2026-02-01',
}

describe('PipelineListView', () => {
  it('renders the table header row', () => {
    render(<PipelineListView pitches={[]} />)
    for (const h of ['Title', 'Stage', 'Source', 'Funding', 'Domain', 'Submitted']) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument()
    }
  })

  it('shows an empty-state row when there are no pitches', () => {
    render(<PipelineListView pitches={[]} />)
    expect(screen.getByText('No pitches match your filters')).toBeInTheDocument()
  })

  it('renders a row per pitch with title and description', () => {
    render(<PipelineListView pitches={[basePitch]} />)
    expect(screen.getByText('Climate Sensor Network')).toBeInTheDocument()
    expect(screen.getByText('A network of low-cost sensors.')).toBeInTheDocument()
  })

  it('maps stage/source/funding keys to their human labels', () => {
    render(<PipelineListView pitches={[basePitch]} />)
    expect(screen.getByText('Due Diligence')).toBeInTheDocument()
    expect(screen.getByText('Referral')).toBeInTheDocument()
    expect(screen.getByText('Government Grant')).toBeInTheDocument()
  })

  it('splits comma-separated domain tags into trimmed chips', () => {
    render(<PipelineListView pitches={[basePitch]} />)
    expect(screen.getByText('climate')).toBeInTheDocument()
    expect(screen.getByText('sensors')).toBeInTheDocument()
  })

  it('shows the Confidential badge for confidential pitches', () => {
    render(<PipelineListView pitches={[{ ...basePitch, is_confidential: true }]} />)
    expect(screen.getByText('Confidential')).toBeInTheDocument()
  })

  it('falls back to the raw stage key when it is unknown', () => {
    render(<PipelineListView pitches={[{ ...basePitch, current_stage: 'mystery_stage' }]} />)
    expect(screen.getByText('mystery_stage')).toBeInTheDocument()
  })

  it('renders a dash for missing source and funding', () => {
    render(
      <PipelineListView
        pitches={[{ ...basePitch, source: undefined, funding_pathway: undefined }]}
      />
    )
    const row = screen.getByText('Climate Sensor Network').closest('tr')
    // both the source and funding cells show "-"
    expect(within(row).getAllByText('-').length).toBeGreaterThanOrEqual(2)
  })

  it('renders a dash for missing submission date', () => {
    render(
      <PipelineListView
        pitches={[{ ...basePitch, submission_date: undefined, source: 'referral', funding_pathway: 'private', domain_tags: 'x' }]}
      />
    )
    const row = screen.getByText('Climate Sensor Network').closest('tr')
    expect(within(row).getByText('-')).toBeInTheDocument()
  })

  it('renders multiple pitch rows', () => {
    render(
      <PipelineListView
        pitches={[
          basePitch,
          { ...basePitch, id: 'p2', title: 'Second Pitch' },
        ]}
      />
    )
    expect(screen.getByText('Climate Sensor Network')).toBeInTheDocument()
    expect(screen.getByText('Second Pitch')).toBeInTheDocument()
  })
})
