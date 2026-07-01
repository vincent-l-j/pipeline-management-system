import { render, screen } from '@testing-library/react'
import AdminRoute from '../AdminRoute'

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    Navigate: ({ to }) => <div data-testid="redirect">redirect:{to}</div>,
  }
})

let mockAuth = { user: { role: 'admin' }, loading: false }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

function Protected() {
  return <div data-testid="protected">Admin content</div>
}

describe('AdminRoute', () => {
  beforeEach(() => {
    mockAuth = { user: { role: 'admin' }, loading: false }
  })

  it('renders children for an admin', () => {
    render(<AdminRoute><Protected /></AdminRoute>)
    expect(screen.getByTestId('protected')).toBeInTheDocument()
    expect(screen.queryByTestId('redirect')).not.toBeInTheDocument()
  })

  it('redirects an assessor away without rendering children', () => {
    mockAuth = { user: { role: 'assessor' }, loading: false }
    render(<AdminRoute><Protected /></AdminRoute>)
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(screen.getByTestId('redirect')).toBeInTheDocument()
  })

  it('redirects a viewer away without rendering children', () => {
    mockAuth = { user: { role: 'viewer' }, loading: false }
    render(<AdminRoute><Protected /></AdminRoute>)
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(screen.getByTestId('redirect')).toBeInTheDocument()
  })

  it('renders nothing while auth is still loading', () => {
    mockAuth = { user: null, loading: true }
    render(<AdminRoute><Protected /></AdminRoute>)
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(screen.queryByTestId('redirect')).not.toBeInTheDocument()
  })
})
