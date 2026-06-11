import api from '../api'

// Access the interceptor handlers registered by the module
function getRequestFulfilled() {
  return api.interceptors.request.handlers.find(Boolean).fulfilled
}

function getResponseRejected() {
  return api.interceptors.response.handlers.find(Boolean).rejected
}

describe('api service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('location', { href: '' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('request interceptor', () => {
    it('attaches Bearer token from localStorage when present', () => {
      localStorage.setItem('token', 'my-jwt-token')
      const config = { headers: {} }
      const result = getRequestFulfilled()(config)
      expect(result.headers.Authorization).toBe('Bearer my-jwt-token')
    })

    it('does not set Authorization header when no token in localStorage', () => {
      const config = { headers: {} }
      const result = getRequestFulfilled()(config)
      expect(result.headers.Authorization).toBeUndefined()
    })

    it('passes config through unmodified (except Authorization)', () => {
      localStorage.setItem('token', 'tok')
      const config = { headers: {}, method: 'GET', url: '/api/foo' }
      const result = getRequestFulfilled()(config)
      expect(result.method).toBe('GET')
      expect(result.url).toBe('/api/foo')
    })
  })

  describe('response interceptor', () => {
    it('clears localStorage and redirects to /login on 401', async () => {
      localStorage.setItem('token', 'tok')
      localStorage.setItem('user', JSON.stringify({ id: 1 }))

      const error = { response: { status: 401 } }
      await expect(getResponseRejected()(error)).rejects.toEqual(error)

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
      expect(window.location.href).toBe('/login')
    })

    it('does not redirect on non-401 errors', async () => {
      const error = { response: { status: 500 } }
      await expect(getResponseRejected()(error)).rejects.toEqual(error)
      expect(window.location.href).toBe('')
    })

    it('handles errors with no response object', async () => {
      const error = { message: 'Network Error' }
      await expect(getResponseRejected()(error)).rejects.toEqual(error)
      expect(window.location.href).toBe('')
    })
  })
})
