import { render, screen, waitFor } from '@testing-library/react'
import PitchCreatePage from '../PitchCreatePage'
import api from '../../services/api'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, useNavigate: () => mockNavigate }
})

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

let mockUser = { role: 'assessor' }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('../../components/Layout', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

describe('PitchCreatePage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    mockUser = { role: 'assessor' }
    vi.mocked(api.get).mockResolvedValue({ data: [] })
  })

  it('resolves lead names via /users/directory, not the admin /users listing', async () => {
    render(<PitchCreatePage />)
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.map(c => c[0])).toContain('/users/directory'),
    )
    // The sensitive admin listing is never called from the create form.
    expect(vi.mocked(api.get).mock.calls.map(c => c[0])).not.toContain('/users')
  })

  it('renders the create form for an assessor', async () => {
    render(<PitchCreatePage />)
    await waitFor(() => expect(screen.getByText('New Pitch')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Add Pitch/i })).toBeInTheDocument()
  })
})
