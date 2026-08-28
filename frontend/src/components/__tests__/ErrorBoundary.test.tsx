import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import type { Mock, MockInstance } from "vitest";
import ErrorBoundary from "../ErrorBoundary";
import { getLastRequestId, reportClientError } from "../../services/api";

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
  reportClientError: vi.fn(),
  getLastRequestId: vi.fn(() => null),
}));

function CrashingPage(): ReactNode {
  throw new Error("Kaboom");
}

function crashingTree() {
  return (
    <ErrorBoundary>
      <div>
        <h2>Pipeline board</h2>
        <CrashingPage />
      </div>
    </ErrorBoundary>
  );
}

// React's dev build re-throws an error it has already handed to a boundary, so
// the window sees it as uncaught; cancelling the event keeps jsdom quiet.
function suppressWindowError(event: ErrorEvent): void {
  event.preventDefault();
}

describe("ErrorBoundary", () => {
  let consoleError: MockInstance;
  let originalLocation: Location;
  let reload: Mock;

  beforeEach(() => {
    // clearMocks only clears recorded calls, so an implementation one test sets
    // would otherwise decide what the next one sees. Restate the defaults here
    // rather than relying on the test order.
    vi.mocked(getLastRequestId).mockReturnValue(null);
    vi.mocked(reportClientError).mockResolvedValue(null);
    localStorage.clear();
    reload = vi.fn();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // Intentionally empty: React logs every error it catches.
    });
    window.addEventListener("error", suppressWindowError);
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { href: "", reload },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // clearMocks only clears recorded calls; without an explicit restore the
    // console spy would stay installed for the rest of the file.
    consoleError.mockRestore();
    localStorage.clear();
    window.removeEventListener("error", suppressWindowError);
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>Pipeline board</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Pipeline board")).toBeInTheDocument();
  });

  it("reports nothing when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>Pipeline board</div>
      </ErrorBoundary>,
    );
    expect(vi.mocked(reportClientError)).not.toHaveBeenCalled();
  });

  it("renders the fallback when a child throws", () => {
    render(crashingTree());
    expect(
      screen.getByRole("heading", { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });

  it("does not render the subtree that failed", () => {
    render(crashingTree());
    expect(screen.queryByText("Pipeline board")).not.toBeInTheDocument();
  });

  it("shows the message of the error that was thrown", () => {
    render(crashingTree());
    expect(screen.getByText("Kaboom")).toBeInTheDocument();
  });

  it("reports the error through the api service", () => {
    render(crashingTree());
    expect(vi.mocked(reportClientError)).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Kaboom" }),
      expect.any(String),
    );
  });

  it("shows the reference the backend recorded the report under", async () => {
    vi.mocked(getLastRequestId).mockReturnValue("req-earlier");
    vi.mocked(reportClientError).mockResolvedValue("req-recorded");
    render(crashingTree());
    expect(await screen.findByText(/req-recorded/)).toBeInTheDocument();
    expect(screen.queryByText(/req-earlier/)).not.toBeInTheDocument();
  });

  it("shows a reference even when no earlier request had been made", async () => {
    vi.mocked(getLastRequestId).mockReturnValue(null);
    vi.mocked(reportClientError).mockResolvedValue("req-recorded");
    render(crashingTree());
    expect(await screen.findByText(/req-recorded/)).toBeInTheDocument();
  });

  it("falls back to the last response id when the report yields none", async () => {
    vi.mocked(getLastRequestId).mockReturnValue("req-abc123");
    vi.mocked(reportClientError).mockResolvedValue(null);
    render(crashingTree());
    expect(await screen.findByText(/req-abc123/)).toBeInTheDocument();
  });

  it("does not claim the problem was reported while the report is in flight", async () => {
    let settle: ((requestId: string | null) => void) | undefined;
    vi.mocked(reportClientError).mockReturnValue(
      new Promise<string | null>((resolve) => {
        settle = resolve;
      }),
    );
    render(crashingTree());

    expect(screen.queryByText(/has been reported/i)).not.toBeInTheDocument();

    settle?.("req-recorded");
    expect(await screen.findByText(/has been reported/i)).toBeInTheDocument();
  });

  it("says the problem could not be reported when the report yields nothing", async () => {
    vi.mocked(getLastRequestId).mockReturnValue(null);
    vi.mocked(reportClientError).mockResolvedValue(null);
    render(crashingTree());
    expect(
      await screen.findByText(/could not be reported/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/reference/i)).not.toBeInTheDocument();
  });

  it("shows the generic message when the thrown value is not an Error", async () => {
    function ThrowingString(): ReactNode {
      // A bare string is exactly the case under test: React hands the boundary
      // whatever was thrown, Error or not.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "just a string";
    }
    render(
      <ErrorBoundary>
        <ThrowingString />
      </ErrorBoundary>,
    );
    expect(
      screen.getByText(/the page stopped working unexpectedly/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(reportClientError)).toHaveBeenCalledWith(
        "just a string",
        expect.any(String),
      );
    });
  });

  it("shows the generic message when the error carries no message", () => {
    function ThrowingEmpty(): ReactNode {
      throw new Error("");
    }
    render(
      <ErrorBoundary>
        <ThrowingEmpty />
      </ErrorBoundary>,
    );
    expect(
      screen.getByText(/the page stopped working unexpectedly/i),
    ).toBeInTheDocument();
  });

  it("reloads the page from the reload button", async () => {
    render(crashingTree());
    await userEvent.click(screen.getByRole("button", { name: /reload page/i }));
    expect(reload).toHaveBeenCalled();
  });

  it("offers a link back to the dashboard", () => {
    render(crashingTree());
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  // Reporting is best-effort, and the sign-out action below is the *only* thing
  // allowed to end the session. A report that fails must not stand in for the user
  // pressing that button: one render error becoming a surprise logout would lose
  // whatever they were doing on top of the crash. The api interceptor already
  // exempts the client-errors path from the 401 redirect; these pin the boundary's
  // own half of it, so a stray `.catch(this.handleSignOut)` cannot be added quietly.
  const STORED_USER = JSON.stringify({ id: 1 });

  it("says the problem could not be reported when the report is rejected", async () => {
    vi.mocked(reportClientError).mockRejectedValue(
      new Error("reporting is down"),
    );

    render(crashingTree());

    expect(
      await screen.findByText(/could not be reported/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/reporting this problem/i),
    ).not.toBeInTheDocument();
  });

  it("keeps the stored session when the report is rejected", async () => {
    localStorage.setItem("token", "abc123");
    localStorage.setItem("user", STORED_USER);
    vi.mocked(reportClientError).mockRejectedValue(
      new Error("reporting is down"),
    );

    render(crashingTree());
    // Awaits the outcome the boundary rendered, so the failure path has finished
    // before the session is inspected.
    await screen.findByText(/could not be reported/i);

    expect(localStorage.getItem("token")).toBe("abc123");
    expect(localStorage.getItem("user")).toBe(STORED_USER);
    // Still the beforeEach value, so nothing navigated anywhere — "/login" least
    // of all.
    expect(window.location.href).toBe("");
  });

  it("keeps the stored session when the report yields no reference", async () => {
    localStorage.setItem("token", "abc123");
    localStorage.setItem("user", STORED_USER);
    vi.mocked(reportClientError).mockResolvedValue(null);

    render(crashingTree());
    await screen.findByText(/could not be reported/i);

    expect(localStorage.getItem("token")).toBe("abc123");
    expect(localStorage.getItem("user")).toBe(STORED_USER);
    expect(window.location.href).toBe("");
  });

  it("clears the stored session and goes to the login page from the sign-out action", async () => {
    localStorage.setItem("token", "abc123");
    localStorage.setItem("user", JSON.stringify({ id: 1 }));
    render(crashingTree());

    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(window.location.href).toBe("/login");
  });
});
