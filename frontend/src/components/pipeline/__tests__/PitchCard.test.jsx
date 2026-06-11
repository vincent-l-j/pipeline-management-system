import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PitchCard from '../PitchCard'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, useNavigate: () => mockNavigate }
})

const basePitch = {
  id: '42',
  title: 'AI-Powered Climate Monitor',
  short_description: 'Real-time atmospheric sensor network using ML.',
  source: 'referral',
  funding_pathway: 'government_grant',
  domain_tags: 'climate, AI, sensors',
  is_confidential: false,
  submission_date: '2026-03-10',
}

function renderCard(pitch = basePitch) {
  return render(
    <PitchCard
      pitch={pitch}
      innerRef={null}
      draggableProps={{}}
      dragHandleProps={{}}
    />
  )
}

describe('PitchCard', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('renders the pitch title', () => {
    renderCard()
    expect(screen.getByText('AI-Powered Climate Monitor')).toBeInTheDocument()
  })

  it('renders the short description', () => {
    renderCard()
    expect(screen.getByText('Real-time atmospheric sensor network using ML.')).toBeInTheDocument()
  })

  it('does not render description section when short_description is absent', () => {
    renderCard({ ...basePitch, short_description: undefined })
    expect(screen.queryByText(/atmospheric/)).not.toBeInTheDocument()
  })

  it('shows the Confidential badge for confidential pitches', () => {
    renderCard({ ...basePitch, is_confidential: true })
    expect(screen.getByText('Confidential')).toBeInTheDocument()
  })

  it('does not show the Confidential badge for non-confidential pitches', () => {
    renderCard()
    expect(screen.queryByText('Confidential')).not.toBeInTheDocument()
  })

  it('renders the source label from SOURCE_LABELS', () => {
    renderCard()
    expect(screen.getByText('Referral')).toBeInTheDocument()
  })

  it('renders the funding pathway label', () => {
    renderCard()
    expect(screen.getByText('Government Grant')).toBeInTheDocument()
  })

  it('renders each domain tag from the comma-separated string', () => {
    renderCard()
    expect(screen.getByText('climate')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('sensors')).toBeInTheDocument()
  })

  it('renders the submission date', () => {
    renderCard()
    expect(screen.getByText('2026-03-10')).toBeInTheDocument()
  })

  it('navigates to the pitch detail page when title is clicked', async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByText('AI-Powered Climate Monitor'))
    expect(mockNavigate).toHaveBeenCalledWith('/pitches/42')
  })

  it('does not render source or funding tags when those fields are absent', () => {
    renderCard({ ...basePitch, source: undefined, funding_pathway: undefined, domain_tags: undefined })
    expect(screen.queryByText('Referral')).not.toBeInTheDocument()
    expect(screen.queryByText('Government Grant')).not.toBeInTheDocument()
  })
})
