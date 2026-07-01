import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrganisationsPage from '../OrganisationsPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

let mockUser = { role: 'admin' }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

// Layout renders Sidebar (router + auth); stub it to isolate the page.
vi.mock('../../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

const ORGS = [
  { id: 'o1', name: 'Soil Tech Labs', org_type: null, sector: 'Agriculture', state_territory: 'NSW' },
]

function setupGet(list = ORGS) {
  vi.mocked(api.get).mockResolvedValue({ data: list })
}

describe('OrganisationsPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.delete).mockReset()
    mockUser = { role: 'admin' }
  })

  it('admin sees Add and per-row Remove', async () => {
    setupGet()
    render(<OrganisationsPage />)
    await waitFor(() => screen.getByText('Soil Tech Labs'))
    expect(screen.getByRole('button', { name: /Add Organisation/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('assessor sees Add only, no Remove', async () => {
    mockUser = { role: 'assessor' }
    setupGet()
    render(<OrganisationsPage />)
    await waitFor(() => screen.getByText('Soil Tech Labs'))
    expect(screen.getByRole('button', { name: /Add Organisation/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('viewer sees a read-only table (no Add, no Remove)', async () => {
    mockUser = { role: 'viewer' }
    setupGet()
    render(<OrganisationsPage />)
    await waitFor(() => screen.getByText('Soil Tech Labs'))
    expect(screen.queryByRole('button', { name: /Add Organisation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('submitting the Add form posts and renders the new row', async () => {
    const user = userEvent.setup()
    setupGet([])
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 'o2', name: 'New Org', org_type: null, sector: 'Energy', state_territory: null },
    })
    render(<OrganisationsPage />)
    await waitFor(() => screen.getByRole('button', { name: /Add Organisation/i }))
    await user.click(screen.getByRole('button', { name: /Add Organisation/i }))
    await user.type(screen.getByPlaceholderText(/Organisation name/i), 'New Org')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(api.post).toHaveBeenCalledWith(
      '/organisations',
      expect.objectContaining({ name: 'New Org' }),
    )
    await waitFor(() => expect(screen.getByText('New Org')).toBeInTheDocument())
  })

  it('Remove asks for confirmation; confirming deletes and removes the row', async () => {
    const user = userEvent.setup()
    setupGet()
    vi.mocked(api.delete).mockResolvedValue({})
    render(<OrganisationsPage />)
    await waitFor(() => screen.getByText('Soil Tech Labs'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(api.delete).toHaveBeenCalledWith('/organisations/o1')
    await waitFor(() => expect(screen.queryByText('Soil Tech Labs')).not.toBeInTheDocument())
  })

  it('cancelling the Remove confirmation does not call the API', async () => {
    const user = userEvent.setup()
    setupGet()
    render(<OrganisationsPage />)
    await waitFor(() => screen.getByText('Soil Tech Labs'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(api.delete).not.toHaveBeenCalled()
    expect(screen.getByText('Soil Tech Labs')).toBeInTheDocument()
  })

  it('a rejected delete leaves the row present and shows an error', async () => {
    const user = userEvent.setup()
    setupGet()
    vi.mocked(api.delete).mockRejectedValue({ response: { data: { detail: 'Delete failed' } } })
    render(<OrganisationsPage />)
    await waitFor(() => screen.getByText('Soil Tech Labs'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.getByText(/Delete failed/)).toBeInTheDocument())
    expect(screen.getByText('Soil Tech Labs')).toBeInTheDocument()
  })
})
