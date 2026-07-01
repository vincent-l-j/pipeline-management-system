import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactsPage from '../ContactsPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

let mockUser = { role: 'admin' }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('../../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

const CONTACTS = [
  { id: 'c1', name: 'Jane Doe', role: 'CTO', email: 'jane@example.com', last_contacted: '2026-01-01' },
]

function setupGet(list = CONTACTS) {
  vi.mocked(api.get).mockResolvedValue({ data: list })
}

describe('ContactsPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.delete).mockReset()
    mockUser = { role: 'admin' }
  })

  it('admin sees Add and per-row Remove', async () => {
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    expect(screen.getByRole('button', { name: /Add Contact/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('assessor sees Add only, no Remove', async () => {
    mockUser = { role: 'assessor' }
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    expect(screen.getByRole('button', { name: /Add Contact/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('viewer sees a read-only table (no Add, no Remove)', async () => {
    mockUser = { role: 'viewer' }
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    expect(screen.queryByRole('button', { name: /Add Contact/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('submitting the Add form posts and renders the new row', async () => {
    const user = userEvent.setup()
    setupGet([])
    vi.mocked(api.post).mockResolvedValue({
      data: { id: 'c2', name: 'New Person', role: null, email: null, last_contacted: null },
    })
    render(<ContactsPage />)
    await waitFor(() => screen.getByRole('button', { name: /Add Contact/i }))
    await user.click(screen.getByRole('button', { name: /Add Contact/i }))
    await user.type(screen.getByPlaceholderText(/Contact name/i), 'New Person')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(api.post).toHaveBeenCalledWith(
      '/contacts',
      expect.objectContaining({ name: 'New Person' }),
    )
    await waitFor(() => expect(screen.getByText('New Person')).toBeInTheDocument())
  })

  it('Remove asks for confirmation; confirming deletes and removes the row', async () => {
    const user = userEvent.setup()
    setupGet()
    vi.mocked(api.delete).mockResolvedValue({})
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(api.delete).toHaveBeenCalledWith('/contacts/c1')
    await waitFor(() => expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument())
  })

  it('cancelling the Remove confirmation does not call the API', async () => {
    const user = userEvent.setup()
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(api.delete).not.toHaveBeenCalled()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('a rejected delete leaves the row present and shows an error', async () => {
    const user = userEvent.setup()
    setupGet()
    vi.mocked(api.delete).mockRejectedValue({ response: { data: { detail: 'Delete failed' } } })
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.getByText(/Delete failed/)).toBeInTheDocument())
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })
})
