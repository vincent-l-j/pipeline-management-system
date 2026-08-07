import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PitchEditPage from '../PitchEditPage'
import api from '../../services/api'

interface Pitch {
  id: string
  title: string
  short_description: string
  submission_date: string | null
  source: string | null
  funding_pathway: string | null
  domain_tags: string | null
  masterplan_alignment: string | null
  is_confidential: boolean
  organisation_id: string | null
  lead_id: string | null
  current_stage: string
}

interface MockUser {
  role: string
}

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    useParams: () => ({ pitchId: '42' }),
    useNavigate: () => mockNavigate,
    Navigate: ({ to }: { to: string }) => <div data-testid="redirect">redirect:{to}</div>,
  }
})

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

let mockUser: MockUser = { role: 'admin' }
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('../../components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const PITCH: Pitch = {
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

function createMockGetHelpers() {
  return (() => {
    const get = vi.mocked(api.get)
    return {
      mockImplementation: (fn: (url: string) => Promise<unknown>) => get.mockImplementation(fn),
      mockReset: () => get.mockReset(),
      get mock() {
        return get
      },
    }
  })()
}

function createMockPatchHelpers() {
  return (() => {
    const patch = vi.mocked(api.patch)
    return {
      mockReset: () => patch.mockReset(),
      mockResolvedValue: (value: unknown) => patch.mockResolvedValue(value),
      get mock() {
        return patch
      },
    }
  })()
}

let mockGetHelpers = createMockGetHelpers()
let mockPatchHelpers = createMockPatchHelpers()

function setupGet() {
  mockGetHelpers.mockImplementation((url: string) => {
    if (url === '/pitches/42') return Promise.resolve({ data: PITCH })
    if (url === '/organisations') return Promise.resolve({ data: [] })
    if (url === '/users') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })
}

describe('PitchEditPage', () => {
  beforeEach(() => {
    mockGetHelpers = createMockGetHelpers()
    mockPatchHelpers = createMockPatchHelpers()
    mockGetHelpers.mockReset()
    mockPatchHelpers.mockReset()
    mockNavigate.mockReset()
    mockUser = { role: 'admin' }
  })

  it('fetches the pitch and pre-fills the form', async () => {
    setupGet()
    render(<PitchEditPage />)
    await waitFor(() =>
      { expect(screen.getByDisplayValue('Original Title')).toBeInTheDocument() },
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
    mockPatchHelpers.mockResolvedValue({ data: { ...PITCH, title: 'New Title' } })
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
    const patchCalls = mockPatchHelpers.mock.calls as unknown[][]
    expect(patchCalls[0][1]).not.toHaveProperty('current_stage')
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalledWith('/pitches/42') })
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
