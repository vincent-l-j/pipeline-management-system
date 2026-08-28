import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

const api: AxiosInstance = axios.create({
  baseURL: "/api",
});

const CLIENT_ERRORS_PATH = "/client-errors";
const REQUEST_ID_HEADER = "x-request-id";

// Mirror the backend schema's caps — over them the whole report is a 422, so a
// truncated stack beats none.
const MAX_MESSAGE_LENGTH = 500;
const MAX_URL_LENGTH = 500;
const MAX_STACK_LENGTH = 4000;
const MAX_REQUEST_ID_LENGTH = 64;

let lastRequestId: string | null = null;
let reportInFlight = false;

// `unknown`, not AxiosResponse["headers"]: that type is non-nullable, and a
// response can reach here with no headers at all.
function readRequestId(headers: unknown): string | null {
  if (!headers || typeof headers !== "object") return null;
  // AxiosHeaders keeps the original casing as own keys and is case-insensitive
  // only via `.get()`; a raw XHR response lowercases. A bracket lookup would
  // work in one and silently fail in the other.
  for (const [name, value] of Object.entries(
    headers as Record<string, unknown>,
  )) {
    if (name.toLowerCase() === REQUEST_ID_HEADER && typeof value === "string") {
      return value || null;
    }
  }
  return null;
}

function captureRequestId(headers: unknown): void {
  const requestId = readRequestId(headers);
  if (requestId) lastRequestId = requestId;
}

function truncate(value: string | null, limit: number): string | null {
  if (value === null) return null;
  return value.length > limit ? value.slice(0, limit) : value;
}

function isClientErrorReport(url: string | undefined): boolean {
  return typeof url === "string" && url.includes(CLIENT_ERRORS_PATH);
}

// Attach the JWT token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If we get a 401, redirect to login
api.interceptors.response.use(
  (response) => {
    captureRequestId(response.headers);
    return response;
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      captureRequestId(error.response?.headers);
      // A rejected error report must not log anyone out — one render error on an
      // expired token would otherwise become a surprise logout.
      if (
        error.response?.status === 401 &&
        !isClientErrorReport(error.config?.url)
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    );
  },
);

/**
 * The request id of the most recent response, or null if none carried one.
 *
 * Best-effort under concurrency: right for "just before the crash", wrong for a
 * per-request banner — don't wire it into `apiErrorMessage`.
 */
export function getLastRequestId(): string | null {
  return lastRequestId;
}

// The 202 body. Optional: a proxy or stale backend can answer without an id, and
// losing the reference must not lose the report.
interface ClientErrorAck {
  request_id?: string;
}

/**
 * Send an uncaught browser failure to the backend log stream.
 *
 * Resolves to the id the backend recorded it under, or null. Never throws, never
 * retries, never recurses — failing to report must not disturb the caller.
 */
export async function reportClientError(
  error: unknown,
  componentStack?: string | null,
): Promise<string | null> {
  if (reportInFlight) return null;
  reportInFlight = true;
  try {
    const normalised =
      error instanceof Error ? error : new Error(String(error));
    const { data } = await api.post<ClientErrorAck>(CLIENT_ERRORS_PATH, {
      message: truncate(
        normalised.message || "Unknown client error",
        MAX_MESSAGE_LENGTH,
      ),
      // The path, never `location.href`: the sign-in redirect carries a live JWT
      // in `?token=`, and the fragment is where an implicit-flow token would sit.
      url: truncate(window.location.pathname, MAX_URL_LENGTH),
      stack: truncate(normalised.stack ?? null, MAX_STACK_LENGTH),
      component_stack: truncate(componentStack ?? null, MAX_STACK_LENGTH),
      // Truncated too: an intermediary stamping a longer id would 422 every report.
      correlated_request_id: truncate(lastRequestId, MAX_REQUEST_ID_LENGTH),
    });
    return data.request_id ?? null;
  } catch {
    // Swallowed on purpose: rethrowing would turn a handled crash into a second one.
    return null;
  } finally {
    reportInFlight = false;
  }
}

export default api;
