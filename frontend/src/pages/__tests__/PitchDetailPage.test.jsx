import { render, screen, waitFor } from '@testing-library/react'
import PitchDetailPage from '../PitchDetailPage'
import api from '../../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    useParams: () => ({ pitchId: '42' }),
    useNavigate: () => mockNavigate,
    Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
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
vi.mock('../../components/pitch/ActivityTimeline', () => ({ default: () => <div /> }))
vi.mock('../../components/pitch/FileLinks', () => ({ default: () => <div /> }))

const BASE_PITCH = {
  id: '42',
  title: 'Test Pitch',
  short_description: 'A description',
  current_stage: 'received',
  is_confidential: false,
  domain_tags: null,
  lead_id: null,
  source: null,
  funding_pathway: null,
  submission_date: null,
  masterplan_alignment: null,
  organisation_id: null,
}

function setupGet(pitch = BASE_PITCH) {
  vi.mocked(api.get).mockImplementation((url) => {
    if (url === '/pitches/42') return Promise.resolve({ data: pitch })
    if (url === '/users') return Promise.resolve({ data: [] })
    if (url.startsWith('/meetings')) return Promise.resolve({ data: [] })
    if (url.startsWith('/assessments')) return Promise.resolve({ data: [] })
    if (url.startsWith('/organisations/')) return Promise.resolve({ data: { name: 'Org' } })
    return Promise.resolve({ data: [] })
  })
}

describe('PitchDetailPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    mockNavigate.mockReset()
    mockUser = { role: 'admin' }
  })

  it('shows an Edit link to the edit route for admin', async () => {
    setupGet()
    render(<PitchDetailPage />)
    await waitFor(() => screen.getByText('Test Pitch'))
    const edit = screen.getByRole('link', { name: 'Edit' })
    expect(edit).toHaveAttribute('href', '/pitches/42/edit')
  })

  it('shows an Edit link for assessor', async () => {
    mockUser = { role: 'assessor' }
    setupGet()
    render(<PitchDetailPage />)
    await waitFor(() => screen.getByText('Test Pitch'))
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument()
  })

  it('hides the Edit link for viewer', async () => {
    mockUser = { role: 'viewer' }
    setupGet()
    render(<PitchDetailPage />)
    await waitFor(() => screen.getByText('Test Pitch'))
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('renders a Confidential badge and remains openable by a viewer', async () => {
    mockUser = { role: 'viewer' }
    setupGet({ ...BASE_PITCH, is_confidential: true })
    render(<PitchDetailPage />)
    await waitFor(() => screen.getByText('Test Pitch'))
    // Viewer can still read the pitch; the flag is a visual marker only.
    expect(screen.getByText('Confidential')).toBeInTheDocument()
    expect(screen.getByText('Test Pitch')).toBeInTheDocument()
  })
})
