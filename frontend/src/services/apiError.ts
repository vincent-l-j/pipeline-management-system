/**
 * Turn a rejected API call into something safe to render.
 *
 * FastAPI sends `detail` as a string for an HTTPException but as a list of error
 * objects for request-validation failures; putting the latter into JSX unmounts
 * the page. A failure with no JSON body at all (a proxy error page, or a 500 from
 * an unhandled exception, which Starlette returns as plain text) falls back to
 * the caller's message plus the status code, so it stays diagnosable.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const response =
    error && typeof error === "object"
      ? (error as { response?: { status?: number; data?: unknown } }).response
      : undefined;
  if (!response) return fallback;

  const data = response.data;
  const detail =
    data && typeof data === "object"
      ? (data as { detail?: unknown }).detail
      : undefined;

  if (typeof detail === "string" && detail) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : null,
      )
      .filter((msg): msg is string => Boolean(msg));
    if (messages.length) return messages.join("; ");
  }

  return response.status
    ? `${fallback} (HTTP ${String(response.status)})`
    : fallback;
}
