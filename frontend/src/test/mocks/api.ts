import { vi } from 'vitest'
import api from '../../services/api'

/**
 * Create mock helpers for API methods.
 * Note: clearMocks: true in vitest config auto-resets mocks between tests.
 */
export function createApiMocks() {
  const get = vi.mocked(api.get)
  const post = vi.mocked(api.post)
  const patch = vi.mocked(api.patch)
  const delete_ = vi.mocked(api.delete)

  return {
    get: {
      mockResolvedValue: (value: unknown) => get.mockResolvedValue(value),
      mockRejectedValue: (error: unknown) => get.mockRejectedValue(error),
      mockReturnValue: (value: unknown) => get.mockReturnValue(value),
      mockImplementation: (fn: (url: string) => Promise<unknown>) => get.mockImplementation(fn),
      get mock() {
        return get
      },
    },
    post: {
      mockResolvedValue: (value: unknown) => post.mockResolvedValue(value),
      mockRejectedValue: (error: unknown) => post.mockRejectedValue(error),
      mockReturnValue: (value: unknown) => post.mockReturnValue(value),
      mockImplementation: (fn: (url: string, data: unknown) => Promise<unknown>) => post.mockImplementation(fn),
      get mock() {
        return post
      },
    },
    patch: {
      mockResolvedValue: (value: unknown) => patch.mockResolvedValue(value),
      mockRejectedValue: (error: unknown) => patch.mockRejectedValue(error),
      mockReturnValue: (value: unknown) => patch.mockReturnValue(value),
      mockImplementation: (fn: (url: string, data: unknown) => Promise<unknown>) => patch.mockImplementation(fn),
      get mock() {
        return patch
      },
    },
    delete: {
      mockResolvedValue: (value: unknown) => delete_.mockResolvedValue(value),
      mockRejectedValue: (error: unknown) => delete_.mockRejectedValue(error),
      mockReturnValue: (value: unknown) => delete_.mockReturnValue(value),
      mockImplementation: (fn: (url: string) => Promise<unknown>) => delete_.mockImplementation(fn),
      get mock() {
        return delete_
      },
    },
  }
}
