import { render, screen } from '@testing-library/react'
import PageHeader from '../PageHeader'

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="My Page" />)
    expect(screen.getByRole('heading', { name: 'My Page' })).toBeInTheDocument()
  })

  it('renders the description when provided', () => {
    render(<PageHeader title="Title" description="Page description text" />)
    expect(screen.getByText('Page description text')).toBeInTheDocument()
  })

  it('does not render a description paragraph when omitted', () => {
    render(<PageHeader title="Title" />)
    expect(screen.queryByText(/description/i)).not.toBeInTheDocument()
  })

  it('renders the action element when provided', () => {
    render(<PageHeader title="Title" action={<button>Create New</button>} />)
    expect(screen.getByRole('button', { name: 'Create New' })).toBeInTheDocument()
  })

  it('does not render an action slot when omitted', () => {
    const { container } = render(<PageHeader title="Title" />)
    // The outer flex div should have only the title-wrapper div, not an action div
    expect(container.firstChild.children).toHaveLength(1)
  })
})
