import { vi } from "vitest";
import api from "../../services/api";

/**
 * Create mock helpers for API methods.
 * Note: clearMocks: true in vitest config auto-resets mocks between tests.
 *
 * unbound-method is disabled below: vi.mocked() needs the method references as
 * values to grab their mock instances. These aren't real unbound calls, and
 * binding them would create new functions that no longer match the mocks the
 * app code invokes.
 */
export function createApiMocks() {
  /* eslint-disable @typescript-eslint/unbound-method */
  const get = vi.mocked(api.get);
  const post = vi.mocked(api.post);
  const patch = vi.mocked(api.patch);
  const delete_ = vi.mocked(api.delete);
  /* eslint-enable @typescript-eslint/unbound-method */

  return {
    get: {
      mockResolvedValue: (value: unknown) => get.mockResolvedValue(value),
      mockRejectedValue: (error: unknown) => get.mockRejectedValue(error),
      mockReturnValue: (value: Promise<unknown>) => get.mockReturnValue(value),
      mockImplementation: (fn: (url: string) => Promise<unknown>) =>
        get.mockImplementation(fn),
      get mock() {
        return get;
      },
    },
    post: {
      mockResolvedValue: (value: unknown) => post.mockResolvedValue(value),
      mockRejectedValue: (error: unknown) => post.mockRejectedValue(error),
      mockReturnValue: (value: Promise<unknown>) => post.mockReturnValue(value),
      mockImplementation: (
        fn: (url: string, data: unknown) => Promise<unknown>,
      ) => post.mockImplementation(fn),
      get mock() {
        return post;
      },
    },
    patch: {
      mockResolvedValue: (value: unknown) => patch.mockResolvedValue(value),
      mockRejectedValue: (error: unknown) => patch.mockRejectedValue(error),
      mockReturnValue: (value: Promise<unknown>) =>
        patch.mockReturnValue(value),
      mockImplementation: (
        fn: (url: string, data: unknown) => Promise<unknown>,
      ) => patch.mockImplementation(fn),
      get mock() {
        return patch;
      },
    },
    delete: {
      mockResolvedValue: (value: unknown) => delete_.mockResolvedValue(value),
      mockRejectedValue: (error: unknown) => delete_.mockRejectedValue(error),
      mockReturnValue: (value: Promise<unknown>) =>
        delete_.mockReturnValue(value),
      mockImplementation: (fn: (url: string) => Promise<unknown>) =>
        delete_.mockImplementation(fn),
      get mock() {
        return delete_;
      },
    },
  };
}
