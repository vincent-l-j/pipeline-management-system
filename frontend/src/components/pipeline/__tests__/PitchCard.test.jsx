import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PitchCard from '../PitchCard'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, useNavigate: () => mockNavigate }
})

let mockUser = { role: 'admin' }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const basePitch = {
  id: '42',
  title: 'AI-Powered Climate Monitor',
  short_description: 'Real-time atmospheric sensor network using ML.',
  source: 'referral',
  funding_pathway: 'government_grant',
  domain_tags: 'climate, AI, sensors',
  is_confidential: false,
  submission_date: '2026-03-10',
  current_stage: 'received',
}

function renderCard(pitch = basePitch, { onStageSelect } = {}) {
  return render(
    <PitchCard
      pitch={pitch}
      innerRef={null}
      draggableProps={{}}
      dragHandleProps={{}}
      onStageSelect={onStageSelect}
    />
  )
}

describe('PitchCard', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockUser = { role: 'admin' }
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

describe('PitchCard stage context menu', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockUser = { role: 'admin' }
  })

  it('opens a stage menu on right-click, listing all stages with the current one marked and not selectable', () => {
    renderCard(basePitch, { onStageSelect: vi.fn() })
    fireEvent.contextMenu(screen.getByText('AI-Powered Climate Monitor'))

    expect(screen.getByTestId('stage-menu')).toBeInTheDocument()
    // Other stages are selectable buttons.
    expect(screen.getByRole('button', { name: 'Initial Screen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Declined' })).toBeInTheDocument()
    // The current stage is marked and not a selectable button.
    expect(screen.getByTestId('current-stage')).toHaveTextContent('Received')
    expect(screen.queryByRole('button', { name: 'Received' })).not.toBeInTheDocument()
  })

  it('selecting a new stage calls onStageSelect(id, from, to) and closes the menu', () => {
    const onStageSelect = vi.fn()
    renderCard(basePitch, { onStageSelect })
    fireEvent.contextMenu(screen.getByText('AI-Powered Climate Monitor'))

    fireEvent.click(screen.getByRole('button', { name: 'Due Diligence' }))
    expect(onStageSelect).toHaveBeenCalledWith('42', 'received', 'due_diligence')
    expect(screen.queryByTestId('stage-menu')).not.toBeInTheDocument()
  })

  it('closes the menu on Escape', () => {
    renderCard(basePitch, { onStageSelect: vi.fn() })
    fireEvent.contextMenu(screen.getByText('AI-Powered Climate Monitor'))
    expect(screen.getByTestId('stage-menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('stage-menu')).not.toBeInTheDocument()
  })

  it('closes the menu on an outside click', () => {
    renderCard(basePitch, { onStageSelect: vi.fn() })
    fireEvent.contextMenu(screen.getByText('AI-Powered Climate Monitor'))
    expect(screen.getByTestId('stage-menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('stage-menu')).not.toBeInTheDocument()
  })

  it('does not open an app stage menu for viewers', () => {
    mockUser = { role: 'viewer' }
    renderCard(basePitch, { onStageSelect: vi.fn() })
    fireEvent.contextMenu(screen.getByText('AI-Powered Climate Monitor'))
    expect(screen.queryByTestId('stage-menu')).not.toBeInTheDocument()
  })
})
