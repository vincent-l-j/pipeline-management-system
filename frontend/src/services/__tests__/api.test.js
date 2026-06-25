import api from '../api'

// The interceptors are registered on the shared axios instance at import time.
// Pull the registered handlers straight off the instance and invoke them
// directly — no network needed to exercise the token/401 logic.
const requestFulfilled = api.interceptors.request.handlers[0].fulfilled
const responseFulfilled = api.interceptors.response.handlers[0].fulfilled
const responseRejected = api.interceptors.response.handlers[0].rejected

describe('api request interceptor', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('attaches a Bearer token when one is stored', () => {
    localStorage.setItem('token', 'abc123')
    const config = requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer abc123')
  })

  it('leaves Authorization unset when no token is stored', () => {
    const config = requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })
})

describe('api response interceptor', () => {
  let originalLocation

  beforeEach(() => {
    localStorage.clear()
    // jsdom's window.location isn't writable by default; swap in a stub so we
    // can observe the redirect without triggering a "navigation not implemented".
    originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })

  it('passes successful responses through unchanged', () => {
    const response = { status: 200, data: { ok: true } }
    expect(responseFulfilled(response)).toBe(response)
  })

  it('clears auth storage and redirects to /login on 401', async () => {
    localStorage.setItem('token', 'abc123')
    localStorage.setItem('user', JSON.stringify({ id: 1 }))
    const error = { response: { status: 401 } }

    await expect(responseRejected(error)).rejects.toBe(error)
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('does not clear storage or redirect on non-401 errors', async () => {
    localStorage.setItem('token', 'abc123')
    const error = { response: { status: 500 } }

    await expect(responseRejected(error)).rejects.toBe(error)
    expect(localStorage.getItem('token')).toBe('abc123')
    expect(window.location.href).toBe('')
  })
})
