import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileLinks from '../FileLinks'
import api from '../../../services/api'

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

let mockUser = { role: 'admin' }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

function setupGet(files = []) {
  vi.mocked(api.get).mockResolvedValue({ data: files })
}

const sampleFiles = [
  { id: 'f1', file_path: 'S:\\Pitches\\deck.pdf', label: 'Pitch Deck', description: 'Latest version' },
  { id: 'f2', file_path: 'S:\\Pitches\\budget.xlsx', label: '', description: '' },
]

describe('FileLinks', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockClear()
    vi.mocked(api.post).mockClear()
    mockUser = { role: 'admin' }
  })

  it('fetches files for the given pitch on mount', async () => {
    setupGet([])
    render(<FileLinks pitchId="99" />)
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/pitches/99/files')
    })
  })

  it('shows the empty state when there are no files', async () => {
    setupGet([])
    render(<FileLinks pitchId="1" />)
    await waitFor(() => {
      expect(screen.getByText('No files linked yet.')).toBeInTheDocument()
    })
  })

  it('renders each file with its label and path', async () => {
    setupGet(sampleFiles)
    render(<FileLinks pitchId="1" />)
    await waitFor(() => {
      expect(screen.getByText('Pitch Deck')).toBeInTheDocument()
    })
    expect(screen.getByText('S:\\Pitches\\deck.pdf')).toBeInTheDocument()
    expect(screen.getByText('Latest version')).toBeInTheDocument()
  })

  it('shows "Untitled" for a file with no label', async () => {
    setupGet(sampleFiles)
    render(<FileLinks pitchId="1" />)
    await waitFor(() => {
      expect(screen.getByText('Untitled')).toBeInTheDocument()
    })
  })

  it('shows the + Add File button for admin users', async () => {
    setupGet([])
    render(<FileLinks pitchId="1" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add File' })).toBeInTheDocument()
    })
  })

  it('shows the + Add File button for assessor users', async () => {
    mockUser = { role: 'assessor' }
    setupGet([])
    render(<FileLinks pitchId="1" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Add File' })).toBeInTheDocument()
    })
  })

  it('does not show the + Add File button for viewer users', async () => {
    mockUser = { role: 'viewer' }
    setupGet([])
    render(<FileLinks pitchId="1" />)
    await waitFor(() => screen.getByText('No files linked yet.'))
    expect(screen.queryByRole('button', { name: '+ Add File' })).not.toBeInTheDocument()
  })

  it('toggles the add form open and closed', async () => {
    const user = userEvent.setup()
    setupGet([])
    render(<FileLinks pitchId="1" />)
    await waitFor(() => screen.getByRole('button', { name: '+ Add File' }))

    await user.click(screen.getByRole('button', { name: '+ Add File' }))
    expect(screen.getByPlaceholderText(/File path/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByPlaceholderText(/File path/)).not.toBeInTheDocument()
  })

  it('disables Add Reference until a file path is entered', async () => {
    const user = userEvent.setup()
    setupGet([])
    render(<FileLinks pitchId="1" />)
    await waitFor(() => screen.getByRole('button', { name: '+ Add File' }))
    await user.click(screen.getByRole('button', { name: '+ Add File' }))

    expect(screen.getByRole('button', { name: 'Add Reference' })).toBeDisabled()
    await user.type(screen.getByPlaceholderText(/File path/), 'C:\\proposal.pdf')
    expect(screen.getByRole('button', { name: 'Add Reference' })).toBeEnabled()
  })

  it('POSTs the new file and reloads the list when Add Reference is clicked', async () => {
    const user = userEvent.setup()
    setupGet([])
    vi.mocked(api.post).mockResolvedValue({})
    render(<FileLinks pitchId="7" />)
    await waitFor(() => screen.getByRole('button', { name: '+ Add File' }))
    await user.click(screen.getByRole('button', { name: '+ Add File' }))

    await user.type(screen.getByPlaceholderText(/File path/), 'C:\\proposal.pdf')
    await user.type(screen.getByPlaceholderText(/Label/), 'Proposal')
    await user.click(screen.getByRole('button', { name: 'Add Reference' }))

    expect(api.post).toHaveBeenCalledWith('/pitches/7/files', {
      file_path: 'C:\\proposal.pdf',
      label: 'Proposal',
      description: '',
    })
    // loadFiles called again after the post (initial + reload)
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2)
    })
  })
})
