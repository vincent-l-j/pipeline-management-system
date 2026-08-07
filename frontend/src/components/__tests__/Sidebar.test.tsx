import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from '../Sidebar'

const mockLogout = vi.fn()
let mockUser = { display_name: 'Alice Admin', role: 'admin' }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}))

function renderSidebar() {
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    mockLogout.mockClear()
    mockUser = { display_name: 'Alice Admin', role: 'admin' }
  })

  it('renders the brand header', () => {
    renderSidebar()
    expect(screen.getByText('Rozetta')).toBeInTheDocument()
    expect(screen.getByText('Pipeline Management')).toBeInTheDocument()
  })

  it('renders all primary navigation links', () => {
    renderSidebar()
    for (const label of [
      'Dashboard', 'Pipeline', 'Pitches', 'Organisations',
      'Contacts', 'Meetings', 'Assessments', 'Search', 'Reports',
    ]) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('points navigation links at the correct routes', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /Pipeline/ })).toHaveAttribute('href', '/pipeline')
    expect(screen.getByRole('link', { name: /Reports/ })).toHaveAttribute('href', '/reports')
  })

  it('shows the Admin section and Users link for admin users', () => {
    renderSidebar()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Users/ })).toHaveAttribute('href', '/admin/users')
  })

  it('hides the Admin section for non-admin users', () => {
    mockUser = { display_name: 'Bob Viewer', role: 'viewer' }
    renderSidebar()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Users/ })).not.toBeInTheDocument()
  })

  it('shows the current user name and role', () => {
    renderSidebar()
    expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('calls logout when Sign out is clicked', async () => {
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(mockLogout).toHaveBeenCalledOnce()
  })
})
