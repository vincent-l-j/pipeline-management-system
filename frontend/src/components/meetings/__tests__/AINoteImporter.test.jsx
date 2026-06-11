import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AINoteImporter from '../AINoteImporter'
import api from '../../../services/api'

vi.mock('../../../services/api', () => ({
  default: { post: vi.fn() },
}))

let mockUser = { role: 'admin' }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const parsedResult = {
  ai_parsed: true,
  summary: 'Discussed the CRC bid timeline.',
  key_points: ['Agreed on Q3 submission', 'Need co-investigator from UQ'],
  action_items: ['Sarah to draft budget'],
  follow_up_date: '2026-04-20',
  attendees: ['Sarah', 'James'],
}

async function expand(user) {
  await user.click(screen.getByRole('button', { name: /Import Meeting Notes/ }))
}

describe('AINoteImporter', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockClear()
    mockUser = { role: 'admin' }
  })

  it('renders nothing for viewer users', () => {
    mockUser = { role: 'viewer' }
    const { container } = render(<AINoteImporter onImport={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the collapsed header for admin users', () => {
    render(<AINoteImporter onImport={vi.fn()} />)
    expect(screen.getByText('Import Meeting Notes')).toBeInTheDocument()
    // textarea hidden until expanded
    expect(screen.queryByPlaceholderText(/Paste your meeting notes/)).not.toBeInTheDocument()
  })

  it('expands to reveal the notes textarea when the header is clicked', async () => {
    const user = userEvent.setup()
    render(<AINoteImporter onImport={vi.fn()} />)
    await expand(user)
    expect(screen.getByPlaceholderText(/Paste your meeting notes/)).toBeInTheDocument()
  })

  it('disables Parse Notes until notes are entered', async () => {
    const user = userEvent.setup()
    render(<AINoteImporter onImport={vi.fn()} />)
    await expand(user)
    expect(screen.getByRole('button', { name: 'Parse Notes' })).toBeDisabled()
    await user.type(screen.getByPlaceholderText(/Paste your meeting notes/), 'Some notes')
    expect(screen.getByRole('button', { name: 'Parse Notes' })).toBeEnabled()
  })

  it('posts the raw notes and shows parsed results', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValue({ data: parsedResult })
    render(<AINoteImporter onImport={vi.fn()} />)
    await expand(user)
    await user.type(screen.getByPlaceholderText(/Paste your meeting notes/), 'Meeting notes text')
    await user.click(screen.getByRole('button', { name: 'Parse Notes' }))

    await waitFor(() => {
      expect(screen.getByText('AI-Parsed Results')).toBeInTheDocument()
    })
    expect(api.post).toHaveBeenCalledWith('/meetings/parse-notes', { raw_notes: 'Meeting notes text' })
    expect(screen.getByText('Discussed the CRC bid timeline.')).toBeInTheDocument()
    expect(screen.getByText('Agreed on Q3 submission')).toBeInTheDocument()
    expect(screen.getByText('Sarah to draft budget')).toBeInTheDocument()
    expect(screen.getByText('2026-04-20')).toBeInTheDocument()
    expect(screen.getByText('Sarah, James')).toBeInTheDocument()
  })

  it('labels results as the basic parser when ai_parsed is false', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValue({ data: { ...parsedResult, ai_parsed: false } })
    render(<AINoteImporter onImport={vi.fn()} />)
    await expand(user)
    await user.type(screen.getByPlaceholderText(/Paste your meeting notes/), 'notes')
    await user.click(screen.getByRole('button', { name: 'Parse Notes' }))
    await waitFor(() => {
      expect(screen.getByText('Parsed Results (Basic Parser)')).toBeInTheDocument()
    })
  })

  it('shows an error message when parsing fails', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockRejectedValue({ response: { data: { detail: 'Bad notes' } } })
    render(<AINoteImporter onImport={vi.fn()} />)
    await expand(user)
    await user.type(screen.getByPlaceholderText(/Paste your meeting notes/), 'notes')
    await user.click(screen.getByRole('button', { name: 'Parse Notes' }))
    await waitFor(() => {
      expect(screen.getByText('Bad notes')).toBeInTheDocument()
    })
  })

  it('calls onImport with parsed data when Apply to Meeting is clicked', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    vi.mocked(api.post).mockResolvedValue({ data: parsedResult })
    render(<AINoteImporter onImport={onImport} />)
    await expand(user)
    await user.type(screen.getByPlaceholderText(/Paste your meeting notes/), 'notes')
    await user.click(screen.getByRole('button', { name: 'Parse Notes' }))
    await waitFor(() => screen.getByRole('button', { name: 'Apply to Meeting' }))

    await user.click(screen.getByRole('button', { name: 'Apply to Meeting' }))
    expect(onImport).toHaveBeenCalledWith(parsedResult)
  })

  it('returns to the paste step when Re-parse is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValue({ data: parsedResult })
    render(<AINoteImporter onImport={vi.fn()} />)
    await expand(user)
    await user.type(screen.getByPlaceholderText(/Paste your meeting notes/), 'notes')
    await user.click(screen.getByRole('button', { name: 'Parse Notes' }))
    await waitFor(() => screen.getByRole('button', { name: 'Re-parse' }))

    await user.click(screen.getByRole('button', { name: 'Re-parse' }))
    expect(screen.getByPlaceholderText(/Paste your meeting notes/)).toBeInTheDocument()
  })

  it('shows "None extracted" when key points and action items are empty', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValue({
      data: { ...parsedResult, key_points: [], action_items: [] },
    })
    render(<AINoteImporter onImport={vi.fn()} />)
    await expand(user)
    await user.type(screen.getByPlaceholderText(/Paste your meeting notes/), 'notes')
    await user.click(screen.getByRole('button', { name: 'Parse Notes' }))
    await waitFor(() => screen.getByText('AI-Parsed Results'))
    expect(screen.getAllByText('None extracted')).toHaveLength(2)
  })
})
