import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ActivityTimeline from '../ActivityTimeline'
import api from '../../../services/api'

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() },
}))

function createMockGetHelpers() {
  return (() => {
    const get = vi.mocked(api.get)
    return {
      mockReturnValue: (value: unknown) => get.mockReturnValue(value),
      mockResolvedValue: (value: unknown) => get.mockResolvedValue(value),
      mockRejectedValue: (error: Error) => get.mockRejectedValue(error),
      mockClear: () => get.mockClear(),
      get mock() {
        return get
      },
    }
  })()
}

let mockGetHelpers = createMockGetHelpers()

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, useNavigate: () => mockNavigate } as unknown
})

function renderTimeline(pitchId = '1') {
  return render(
    <MemoryRouter>
      <ActivityTimeline pitchId={pitchId} />
    </MemoryRouter>
  )
}

describe('ActivityTimeline', () => {
  beforeEach(() => {
    mockGetHelpers = createMockGetHelpers()
  })

  it('shows loading text initially', () => {
    mockGetHelpers.mockReturnValue(new Promise(/* never resolves */ () => {
      // Intentionally empty - promise never resolves
    }))
    renderTimeline()
    expect(screen.getByText('Loading timeline...')).toBeInTheDocument()
  })

  it('shows empty message when no events are returned', async () => {
    mockGetHelpers.mockResolvedValue({ data: { events: [] } })
    renderTimeline()
    await waitFor(() => {
      expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument()
    })
  })

  it('shows empty message when the API call fails', async () => {
    mockGetHelpers.mockRejectedValue(new Error('Network Error'))
    renderTimeline()
    await waitFor(() => {
      expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument()
    })
  })

  it('renders each event title after data loads', async () => {
    mockGetHelpers.mockResolvedValue({
      data: {
        events: [
          { type: 'created', title: 'Pitch Received', date: '2026-01-01T10:00:00Z', actor: 'Admin' },
          { type: 'stage_change', title: 'Moved to Assessment', date: '2026-01-10T09:00:00Z' },
        ],
      },
    })
    renderTimeline()
    await waitFor(() => {
      expect(screen.getByText('Pitch Received')).toBeInTheDocument()
      expect(screen.getByText('Moved to Assessment')).toBeInTheDocument()
    })
  })

  it('renders event description when present', async () => {
    mockGetHelpers.mockResolvedValue({
      data: {
        events: [
          {
            type: 'created',
            title: 'Pitch Received',
            description: 'Initial submission via referral.',
            date: '2026-01-01T10:00:00Z',
          },
        ],
      },
    })
    renderTimeline()
    await waitFor(() => {
      expect(screen.getByText('Initial submission via referral.')).toBeInTheDocument()
    })
  })

  it('renders actor name when present', async () => {
    mockGetHelpers.mockResolvedValue({
      data: {
        events: [
          { type: 'created', title: 'Created', date: '2026-01-01T10:00:00Z', actor: 'Jane Smith' },
        ],
      },
    })
    renderTimeline()
    await waitFor(() => {
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument()
    })
  })

  it('shows "click to view" hint for meeting events', async () => {
    mockGetHelpers.mockResolvedValue({
      data: {
        events: [
          { type: 'meeting', title: 'Discovery Meeting', date: '2026-02-01T14:00:00Z', meeting_id: 10 },
        ],
      },
    })
    renderTimeline()
    await waitFor(() => {
      expect(screen.getByText('click to view')).toBeInTheDocument()
    })
  })

  it('navigates to meeting page when a meeting event is clicked', async () => {
    const user = userEvent.setup()
    mockGetHelpers.mockResolvedValue({
      data: {
        events: [
          { type: 'meeting', title: 'Discovery Meeting', date: '2026-02-01T14:00:00Z', meeting_id: 10 },
        ],
      },
    })
    renderTimeline()
    await waitFor(() => screen.getByText('Discovery Meeting'))
    await user.click(screen.getByText('Discovery Meeting'))
    expect(mockNavigate).toHaveBeenCalledWith('/meetings/10')
  })

  it('navigates to assessment page when an assessment event is clicked', async () => {
    const user = userEvent.setup()
    mockGetHelpers.mockResolvedValue({
      data: {
        events: [
          { type: 'assessment', title: 'Deep Assessment', date: '2026-03-01T10:00:00Z', assessment_id: 7 },
        ],
      },
    })
    renderTimeline()
    await waitFor(() => screen.getByText('Deep Assessment'))
    await user.click(screen.getByText('Deep Assessment'))
    expect(mockNavigate).toHaveBeenCalledWith('/assessments/7')
  })

  it('fetches timeline for the given pitchId', async () => {
    mockGetHelpers.mockResolvedValue({ data: { events: [] } })
    renderTimeline('99')
    await waitFor(() => screen.getByText('No activity recorded yet.'))
    expect(mockGetHelpers.mock).toHaveBeenCalledWith('/pitches/99/timeline')
  })
})
