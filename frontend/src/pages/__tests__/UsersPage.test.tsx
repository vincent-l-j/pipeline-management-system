import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UsersPage from '../UsersPage'
import api from '../../services/api'

interface User {
  id: string
  display_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

interface MockUser {
  role: string
}

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}))

let mockUser: MockUser = { role: 'admin' }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('../../components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../components/PageHeader', () => ({
  default: ({ title, description }: { title: string; description: string }) => <div><h1>{title}</h1><p>{description}</p></div>,
}))

const mockUsers: User[] = [
  { id: '1', display_name: 'Admin User', email: 'admin@test.com', role: 'admin', is_active: true, created_at: '2024-01-01' },
  { id: '2', display_name: 'Assessor User', email: 'assessor@test.com', role: 'assessor', is_active: true, created_at: '2024-01-01' },
  { id: '3', display_name: 'Viewer User', email: 'viewer@test.com', role: 'viewer', is_active: false, created_at: '2024-01-01' },
]

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ data: mockUsers })
    vi.mocked(api.patch).mockReset()
    mockUser = { role: 'admin' }
  })

  it('renders the page header', async () => {
    render(<UsersPage />)
    expect(screen.getByText('User Management')).toBeInTheDocument()
  })

  it('lists all users with their details', async () => {
    render(<UsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
      expect(screen.getByText('Assessor User')).toBeInTheDocument()
      expect(screen.getByText('assessor@test.com')).toBeInTheDocument()
      expect(screen.getByText('Viewer User')).toBeInTheDocument()
      expect(screen.getByText('viewer@test.com')).toBeInTheDocument()
    })
  })

  it('shows Edit button for each user', async () => {
    render(<UsersPage />)

    await waitFor(() => {
      const editButtons = screen.getAllByRole('button', { name: 'Edit' })
      expect(editButtons.length).toBe(mockUsers.length)
    })
  })

  it('opens edit form when Edit button is clicked', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/change role/i)).toBeInTheDocument()
    })
  })

  it('allows changing a user role', async () => {
    const user = userEvent.setup()
    vi.mocked(api.patch).mockResolvedValue({
      data: { ...mockUsers[1], role: 'admin' }
    })

    render(<UsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Assessor User')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[1])

    await waitFor(() => {
      const roleSelect = screen.getByDisplayValue('assessor')
      expect(roleSelect).toBeInTheDocument()
    })

    const roleSelect = screen.getByDisplayValue('assessor')
    await user.selectOptions(roleSelect, 'admin')

    const saveButton = screen.getAllByRole('button', { name: 'Save' })[0]
    await user.click(saveButton)

    await waitFor(() => {
      expect(vi.mocked(api.patch)).toHaveBeenCalledWith('/users/2', { role: 'admin' })
    })
  })

  it('closes edit form on Cancel without saving', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/change role/i)).toBeInTheDocument()
    })

    const cancelButton = screen.getAllByRole('button', { name: 'Cancel' })[0]
    await user.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByText(/change role/i)).not.toBeInTheDocument()
    })

    expect(vi.mocked(api.patch)).not.toHaveBeenCalled()
  })

  it('shows error message on patch failure', async () => {
    const user = userEvent.setup()
    vi.mocked(api.patch).mockRejectedValue({
      response: { data: { detail: 'Permission denied' } }
    })

    render(<UsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[0])

    await waitFor(() => {
      const roleSelect = screen.getByDisplayValue('admin')
      expect(roleSelect).toBeInTheDocument()
    })

    const roleSelect = screen.getByDisplayValue('admin')
    await user.selectOptions(roleSelect, 'viewer')

    const saveButton = screen.getAllByRole('button', { name: 'Save' })[0]
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeInTheDocument()
    })
  })
})
