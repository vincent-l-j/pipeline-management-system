import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScoreSelector from '../ScoreSelector'

const criterion = {
  key: 'team_capability',
  label: 'Team Capability',
  description: 'Track record, expertise, and execution capacity',
}

describe('ScoreSelector', () => {
  it('renders the criterion label and description', () => {
    render(<ScoreSelector criterion={criterion} value={null} onChange={vi.fn()} />)
    expect(screen.getByText('Team Capability')).toBeInTheDocument()
    expect(screen.getByText('Track record, expertise, and execution capacity')).toBeInTheDocument()
  })

  it('renders 5 numbered score buttons', () => {
    render(<ScoreSelector criterion={criterion} value={null} onChange={vi.fn()} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: new RegExp(`${i}`) })).toBeInTheDocument()
    }
  })

  it('shows score label text when a value is set', () => {
    render(<ScoreSelector criterion={criterion} value={4} onChange={vi.fn()} />)
    expect(screen.getByText(/4\/5/)).toBeInTheDocument()
    expect(screen.getByText(/High/)).toBeInTheDocument()
  })

  it('does not show score label when value is null', () => {
    render(<ScoreSelector criterion={criterion} value={null} onChange={vi.fn()} />)
    expect(screen.queryByText(/\/5/)).not.toBeInTheDocument()
  })

  it('calls onChange with the clicked score', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ScoreSelector criterion={criterion} value={null} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /3/ }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('does not call onChange when readOnly', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ScoreSelector criterion={criterion} value={2} onChange={onChange} readOnly />)
    await user.click(screen.getByRole('button', { name: /3/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables all buttons when readOnly', () => {
    render(<ScoreSelector criterion={criterion} value={3} onChange={vi.fn()} readOnly />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => expect(btn).toBeDisabled())
  })

  it('renders the score progress bar', () => {
    const { container } = render(<ScoreSelector criterion={criterion} value={3} onChange={vi.fn()} />)
    const bar = container.querySelector('[style*="width"]')
    expect(bar).toHaveStyle({ width: '60%' })
  })

  it('score bar is 0% width when no value is set', () => {
    const { container } = render(<ScoreSelector criterion={criterion} value={null} onChange={vi.fn()} />)
    const bar = container.querySelector('[style]')
    expect(bar).toHaveStyle({ width: '0%' })
  })
})
