import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../AuthContext'

function TestConsumer() {
  const { user, token, loading, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
      <span data-testid="token">{token || 'null'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <button onClick={() => login('tok123', { id: 1, name: 'Alice' })}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides null user and token when localStorage is empty', () => {
    renderWithProvider()
    expect(screen.getByTestId('user').textContent).toBe('null')
    expect(screen.getByTestId('token').textContent).toBe('null')
  })

  it('loading becomes false after mount', async () => {
    renderWithProvider()
    await act(async () => {})
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('restores token and user from localStorage on mount', () => {
    localStorage.setItem('token', 'saved-token')
    localStorage.setItem('user', JSON.stringify({ id: 2, name: 'Bob' }))
    renderWithProvider()
    expect(screen.getByTestId('token').textContent).toBe('saved-token')
    expect(screen.getByTestId('user').textContent).toContain('Bob')
  })

  it('login persists token and user to localStorage and updates state', async () => {
    const user = userEvent.setup()
    renderWithProvider()
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(localStorage.getItem('token')).toBe('tok123')
    expect(JSON.parse(localStorage.getItem('user'))).toEqual({ id: 1, name: 'Alice' })
    expect(screen.getByTestId('token').textContent).toBe('tok123')
    expect(screen.getByTestId('user').textContent).toContain('Alice')
  })

  it('logout clears localStorage and resets state to null', async () => {
    localStorage.setItem('token', 'old-token')
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Alice' }))
    const user = userEvent.setup()
    renderWithProvider()

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(screen.getByTestId('token').textContent).toBe('null')
    expect(screen.getByTestId('user').textContent).toBe('null')
  })

  it('useAuth throws when used outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function InvalidConsumer() {
      useAuth()
      return null
    }
    expect(() => render(<InvalidConsumer />)).toThrow('useAuth must be used within AuthProvider')
    consoleSpy.mockRestore()
  })

  it('children are rendered inside the provider', () => {
    render(
      <AuthProvider>
        <span data-testid="child">hello</span>
      </AuthProvider>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})
