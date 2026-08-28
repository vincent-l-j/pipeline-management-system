import { Component, ErrorInfo, ReactNode } from "react";
import { getLastRequestId, reportClientError } from "../services/api";

interface ErrorBoundaryProps {
  children: ReactNode;
}

type ReportStatus = "pending" | "reported" | "failed";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  requestId: string | null;
  reportStatus: ReportStatus;
}

const GENERIC_MESSAGE = "The page stopped working unexpectedly.";

// Outcomes, never promises — reporting is best-effort, so never claim it worked
// before it has.
const REPORT_STATUS_MESSAGE: Record<ReportStatus, string> = {
  pending: "Reporting this problem…",
  reported: "This problem has been reported.",
  failed:
    "This problem could not be reported automatically. Please tell your administrator what you were doing.",
};

/**
 * Show a recoverable screen instead of a blank page when a render throws.
 *
 * **A boundary cannot catch an error thrown by its own fallback**, so the fallback
 * uses no hooks, router or data fetching — hence the plain `<a>`,
 * `window.location` and direct `localStorage` access below.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
    requestId: null,
    reportStatus: "pending",
  };

  static getDerivedStateFromError(
    error: unknown,
  ): Pick<ErrorBoundaryState, "hasError" | "message"> {
    return {
      hasError: true,
      message:
        error instanceof Error && error.message
          ? error.message
          : GENERIC_MESSAGE,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void reportClientError(error, info.componentStack)
      .then((reportedId) => {
        this.setState({
          // The id just written beats the last response's, and exists even when
          // the crash preceded any request.
          requestId: reportedId ?? getLastRequestId(),
          reportStatus: reportedId ? "reported" : "failed",
        });
      })
      // Unreachable today, but a `.then` without one strands the fallback on
      // "Reporting…"; see "Errors" in docs/best-practices/frontend-react.md.
      .catch(() => {
        this.setState({
          requestId: getLastRequestId(),
          reportStatus: "failed",
        });
      });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  // The only action that escapes a crash caused by a corrupted stored session:
  // reload and the dashboard link both re-run `AuthProvider`'s parse.
  handleSignOut = (): void => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl border border-navy-100 p-6 max-w-lg w-full space-y-4">
          <h1 className="text-2xl font-bold text-navy-900">
            Something went wrong
          </h1>
          <p className="text-sm text-navy-500">
            This page failed to load. Reloading or returning to the dashboard
            may get you moving again; if it keeps happening, sign out and start
            over.
          </p>
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {this.state.message}
          </div>
          <p className="text-sm text-navy-500">
            {REPORT_STATUS_MESSAGE[this.state.reportStatus]}
          </p>
          {this.state.requestId ? (
            <p className="text-sm text-navy-500">
              Reference: {this.state.requestId}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="bg-navy-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
            >
              Reload page
            </button>
            <a
              href="/"
              className="text-sm font-medium text-navy-500 hover:text-navy-900 transition-colors"
            >
              Back to dashboard
            </a>
            <button
              type="button"
              onClick={this.handleSignOut}
              className="text-sm font-medium text-navy-500 hover:text-navy-900 transition-colors"
            >
              Sign out and start over
            </button>
          </div>
        </div>
      </div>
    );
  }
}
