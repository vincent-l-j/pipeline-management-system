import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PitchEditPage from '../PitchEditPage'
import api from '../../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    useParams: () => ({ pitchId: '42' }),
    useNavigate: () => mockNavigate,
    Navigate: ({ to }) => <div data-testid="redirect">redirect:{to}</div>,
  }
})

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

let mockUser = { role: 'admin' }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('../../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

const PITCH = {
  id: '42',
  title: 'Original Title',
  short_description: 'Original description',
  submission_date: '2026-01-01',
  source: 'referral',
  funding_pathway: 'rdti',
  domain_tags: 'climate,health',
  masterplan_alignment: 'Aligned',
  is_confidential: false,
  organisation_id: '',
  lead_id: '',
  current_stage: 'initial_screen',
}

function setupGet() {
  vi.mocked(api.get).mockImplementation((url) => {
    if (url === '/pitches/42') return Promise.resolve({ data: PITCH })
    if (url === '/organisations') return Promise.resolve({ data: [] })
    if (url === '/users') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })
}

describe('PitchEditPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.patch).mockReset()
    mockNavigate.mockReset()
    mockUser = { role: 'admin' }
  })

  it('fetches the pitch and pre-fills the form', async () => {
    setupGet()
    render(<PitchEditPage />)
    await waitFor(() =>
      expect(screen.getByDisplayValue('Original Title')).toBeInTheDocument(),
    )
    expect(screen.getByDisplayValue('Original description')).toBeInTheDocument()
  })

  it('does not offer a pipeline-stage selector', async () => {
    setupGet()
    render(<PitchEditPage />)
    await waitFor(() => screen.getByDisplayValue('Original Title'))
    expect(screen.queryByLabelText(/stage/i)).not.toBeInTheDocument()
  })

  it('saving PATCHes the pitch then navigates to the detail route', async () => {
    const user = userEvent.setup()
    setupGet()
    vi.mocked(api.patch).mockResolvedValue({ data: { ...PITCH, title: 'New Title' } })
    render(<PitchEditPage />)
    await waitFor(() => screen.getByDisplayValue('Original Title'))

    const titleInput = screen.getByDisplayValue('Original Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'New Title')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(api.patch).toHaveBeenCalledWith(
      '/pitches/42',
      expect.objectContaining({ title: 'New Title' }),
    )
    // Stage is never sent from the edit form.
    expect(api.patch.mock.calls[0][1]).not.toHaveProperty('current_stage')
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/pitches/42'))
  })

  it('Cancel returns to the detail route without calling the API', async () => {
    const user = userEvent.setup()
    setupGet()
    render(<PitchEditPage />)
    await waitFor(() => screen.getByDisplayValue('Original Title'))

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(api.patch).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/pitches/42')
  })

  it('redirects a viewer away from the edit route without rendering the form', async () => {
    mockUser = { role: 'viewer' }
    setupGet()
    render(<PitchEditPage />)
    await waitFor(() => screen.getByTestId('redirect'))
    expect(screen.getByTestId('redirect')).toHaveTextContent('/pitches/42')
    expect(screen.queryByDisplayValue('Original Title')).not.toBeInTheDocument()
  })
})
