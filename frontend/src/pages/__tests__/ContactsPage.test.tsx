import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactsPage from '../ContactsPage'
import { createApiMocks } from '../../test/mocks/api'

interface Contact {
  id: string
  name: string
  role: string | null
  email: string | null
  last_contacted: string | null
}

interface MockUser {
  role: string
}

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const apiMocks = createApiMocks()

let mockUser: MockUser = { role: 'admin' }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('../../components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const CONTACTS: Contact[] = [
  { id: 'c1', name: 'Jane Doe', role: 'CTO', email: 'jane@example.com', last_contacted: '2026-01-01' },
]

function setupGet(list: Contact[] = CONTACTS) {
  apiMocks.get.mockResolvedValue({ data: list })
}

describe('ContactsPage', () => {
  beforeEach(() => {
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
    apiMocks.post.mockResolvedValue({
      data: { id: 'c2', name: 'New Person', role: null, email: null, last_contacted: null },
    })
    render(<ContactsPage />)
    await waitFor(() => screen.getByRole('button', { name: /Add Contact/i }))
    await user.click(screen.getByRole('button', { name: /Add Contact/i }))
    await user.type(screen.getByPlaceholderText(/Contact name/i), 'New Person')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      '/contacts',
      expect.objectContaining({ name: 'New Person' }),
    )
    await waitFor(() => { expect(screen.getByText('New Person')).toBeInTheDocument(); })
  })

  it('Remove asks for confirmation; confirming deletes and removes the row', async () => {
    const user = userEvent.setup()
    setupGet()
    apiMocks.delete.mockResolvedValue({})
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(apiMocks.delete.mock).toHaveBeenCalledWith('/contacts/c1')
    await waitFor(() => { expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument(); })
  })

  it('cancelling the Remove confirmation does not call the API', async () => {
    const user = userEvent.setup()
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(apiMocks.delete.mock).not.toHaveBeenCalled()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('a rejected delete leaves the row present and shows an error', async () => {
    const user = userEvent.setup()
    setupGet()
    apiMocks.delete.mockRejectedValue({ response: { data: { detail: 'Delete failed' } } })
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => { expect(screen.getByText(/Delete failed/)).toBeInTheDocument(); })
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('admin sees per-row Edit button', async () => {
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('assessor sees per-row Edit button', async () => {
    mockUser = { role: 'assessor' }
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('viewer does not see Edit button', async () => {
    mockUser = { role: 'viewer' }
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('Edit opens a form pre-filled with the current values', async () => {
    const user = userEvent.setup()
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('CTO')).toBeInTheDocument()
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument()
  })

  it('saving an edit patches the changed fields and updates the row in place', async () => {
    const user = userEvent.setup()
    setupGet()
    apiMocks.patch.mockResolvedValue({
      data: { ...CONTACTS[0], name: 'Jane Smith' },
    })
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByDisplayValue('Jane Doe')
    await user.clear(nameInput)
    await user.type(nameInput, 'Jane Smith')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(apiMocks.patch.mock).toHaveBeenCalledWith('/contacts/c1', { name: 'Jane Smith' })
    await waitFor(() => { expect(screen.getByText('Jane Smith')).toBeInTheDocument(); })
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
  })

  it('cancelling the edit makes no api.patch call', async () => {
    const user = userEvent.setup()
    setupGet()
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByDisplayValue('Jane Doe')
    await user.clear(nameInput)
    await user.type(nameInput, 'Jane Smith')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(apiMocks.patch.mock).not.toHaveBeenCalled()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })

  it('a rejected edit leaves the row unchanged and shows an error', async () => {
    const user = userEvent.setup()
    setupGet()
    apiMocks.patch.mockRejectedValue({ response: { data: { detail: 'Update failed' } } })
    render(<ContactsPage />)
    await waitFor(() => screen.getByText('Jane Doe'))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const nameInput = screen.getByDisplayValue('Jane Doe')
    await user.clear(nameInput)
    await user.type(nameInput, 'Jane Smith')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => { expect(screen.getByText(/Update failed/)).toBeInTheDocument(); })
    // The underlying row was never mutated: cancelling restores the original value.
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
  })
})
