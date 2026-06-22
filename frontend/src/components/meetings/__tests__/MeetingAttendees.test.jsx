import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MeetingAttendees from '../MeetingAttendees'
import api from '../../../services/api'

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

let mockUser = { role: 'admin' }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const mockUsers = [
  { id: 'u1', display_name: 'Alice Staff' },
  { id: 'u2', display_name: 'Bob Staff' },
]
const mockContacts = [{ id: 'c1', name: 'External Contact' }]

function setupApiMocks(attendees = []) {
  vi.mocked(api.get).mockImplementation((url) => {
    if (url.includes('/attendees')) return Promise.resolve({ data: attendees })
    if (url === '/users') return Promise.resolve({ data: mockUsers })
    if (url === '/contacts') return Promise.resolve({ data: mockContacts })
    return Promise.reject(new Error(`Unexpected: ${url}`))
  })
}

describe('MeetingAttendees', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockClear()
    vi.mocked(api.post).mockClear()
    vi.mocked(api.delete).mockClear()
    mockUser = { role: 'admin' }
  })

  it('shows "No attendees recorded." when the list is empty', async () => {
    setupApiMocks([])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => {
      expect(screen.getByText('No attendees recorded.')).toBeInTheDocument()
    })
  })

  it('renders the list of attendees', async () => {
    setupApiMocks([
      { id: 'a1', user_id: 'u1', is_internal: true },
      { id: 'a2', contact_id: 'c1', is_internal: false },
    ])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => {
      expect(screen.getByText('Alice Staff')).toBeInTheDocument()
      expect(screen.getByText('External Contact')).toBeInTheDocument()
    })
  })

  it('shows Internal/External labels for each attendee', async () => {
    setupApiMocks([
      { id: 'a1', user_id: 'u1', is_internal: true },
      { id: 'a2', contact_id: 'c1', is_internal: false },
    ])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => {
      expect(screen.getByText('Internal')).toBeInTheDocument()
      expect(screen.getByText('External')).toBeInTheDocument()
    })
  })

  it('shows the Add button for admin users', async () => {
    setupApiMocks([])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument()
    })
  })

  it('shows the Add button for assessor users', async () => {
    mockUser = { role: 'assessor' }
    setupApiMocks([])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument()
    })
  })

  it('does not show the Add button for viewer users', async () => {
    mockUser = { role: 'viewer' }
    setupApiMocks([])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => screen.getByText('No attendees recorded.'))
    expect(screen.queryByRole('button', { name: '+ Add' })).not.toBeInTheDocument()
  })

  it('shows the add form when the Add button is clicked', async () => {
    const user = userEvent.setup()
    setupApiMocks([])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => screen.getByRole('button', { name: '+ Add' }))
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    expect(screen.getByRole('button', { name: 'Rozetta Staff' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'External Contact' })).toBeInTheDocument()
  })

  it('shows Cancel button and hides Add form when Cancel is clicked', async () => {
    const user = userEvent.setup()
    setupApiMocks([])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => screen.getByRole('button', { name: '+ Add' }))
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('populates the staff select with users from the API', async () => {
    const user = userEvent.setup()
    setupApiMocks([])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => screen.getByRole('button', { name: '+ Add' }))
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    expect(screen.getByRole('option', { name: 'Alice Staff' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bob Staff' })).toBeInTheDocument()
  })

  it('calls POST and reloads attendees when an attendee is added', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValue({})
    setupApiMocks([])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => screen.getByRole('button', { name: '+ Add' }))
    await user.click(screen.getByRole('button', { name: '+ Add' }))

    await user.selectOptions(screen.getByRole('combobox'), 'u1')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(api.post).toHaveBeenCalledWith('/meetings/1/attendees', {
      user_id: 'u1',
      is_internal: true,
    })
  })

  it('calls DELETE when Remove is clicked for an attendee', async () => {
    const user = userEvent.setup()
    vi.mocked(api.delete).mockResolvedValue({})
    setupApiMocks([{ id: 'a1', user_id: 'u1', is_internal: true }])
    render(<MeetingAttendees meetingId="1" />)
    await waitFor(() => screen.getByText('Alice Staff'))

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(api.delete).toHaveBeenCalledWith('/meetings/1/attendees/a1')
  })
})
