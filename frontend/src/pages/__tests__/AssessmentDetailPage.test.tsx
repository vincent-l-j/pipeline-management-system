import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssessmentDetailPage from "../AssessmentDetailPage";
import { createApiMocks } from "../../test/mocks/api";

interface Assessment {
  id: string;
  pitch_id: string;
  version: number;
  assessment_date: string;
  assessor_id: string;
  recommendation: string;
}

interface MockUser {
  role: string;
}

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useParams: () => ({ assessmentId: "a2" }),
    useNavigate: () => mockNavigate,
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
      <a href={to}>{children}</a>
    ),
  };
});

vi.mock("../../services/api", () => ({
  default: { get: vi.fn() },
}));

const apiMocks = createApiMocks();

let mockUser: MockUser = { role: "admin" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("../../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../../components/assessments/ScoringCard", () => ({
  default: ({ assessment }: { assessment: Assessment }) => (
    <div>ScoringCard v{assessment.version}</div>
  ),
}));

const V2: Assessment = {
  id: "a2",
  pitch_id: "p1",
  version: 2,
  assessment_date: "2026-02-01",
  assessor_id: "u2",
  recommendation: "proceed",
};
const V1: Assessment = {
  id: "a1",
  pitch_id: "p1",
  version: 1,
  assessment_date: "2026-01-01",
  assessor_id: "u1",
  recommendation: "park",
};

function setupGet() {
  apiMocks.get.mockImplementation((url: string) => {
    if (url === "/assessments/a2") return Promise.resolve({ data: V2 });
    if (url === "/users/directory")
      return Promise.resolve({
        data: [
          { id: "u1", display_name: "Alice" },
          { id: "u2", display_name: "Bob" },
        ],
      });
    if (url === "/pitches/p1")
      return Promise.resolve({
        data: { id: "p1", title: "Solar Pitch", current_stage: "discovery" },
      });
    if (url === "/pitches/p1/assessments")
      return Promise.resolve({ data: [V1, V2] });
    return Promise.resolve({ data: [] });
  });
}

describe("AssessmentDetailPage", () => {
  beforeEach(() => {
    mockUser = { role: "admin" };
  });

  it("admin/assessor see an Amend control; viewer does not", async () => {
    setupGet();
    const { unmount } = render(<AssessmentDetailPage />);
    await waitFor(() => screen.getByText(/Assessment for/));
    expect(screen.getByRole("link", { name: /amend/i })).toBeInTheDocument();
    unmount();

    mockUser = { role: "assessor" };
    setupGet();
    const second = render(<AssessmentDetailPage />);
    await waitFor(() => screen.getByText(/Assessment for/));
    expect(screen.getByRole("link", { name: /amend/i })).toBeInTheDocument();
    second.unmount();

    mockUser = { role: "viewer" };
    setupGet();
    render(<AssessmentDetailPage />);
    await waitFor(() => screen.getByText(/Assessment for/));
    expect(
      screen.queryByRole("link", { name: /amend/i }),
    ).not.toBeInTheDocument();
  });

  it("the Amend control targets the create form pre-filled from the latest version", async () => {
    setupGet();
    render(<AssessmentDetailPage />);
    await waitFor(() => screen.getByText(/Assessment for/));
    const amend = screen.getByRole("link", { name: /amend/i });
    expect(amend).toHaveAttribute(
      "href",
      "/assessments/new?pitch_id=p1&from=a2",
    );
  });

  it("lists every version newest-first with the latest marked current", async () => {
    setupGet();
    render(<AssessmentDetailPage />);
    await waitFor(() => screen.getByText(/Assessment for/));

    const versionButtons = screen
      .getAllByRole("button")
      .filter((b) => /^v\d/.test(b.textContent || ""));
    expect(versionButtons).toHaveLength(2);
    // Newest first: v2 before v1.
    expect(versionButtons[0]).toHaveTextContent("v2");
    expect(versionButtons[1]).toHaveTextContent("v1");
    // The latest (v2) is marked current.
    expect(versionButtons[0]).toHaveTextContent(/current/i);
    expect(versionButtons[1]).not.toHaveTextContent(/current/i);
  });

  it("a prior version can be opened (navigates to its detail route)", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<AssessmentDetailPage />);
    await waitFor(() => screen.getByText(/Assessment for/));
    const priorButton = screen.getByRole("button", { name: /^v1/ });
    await user.click(priorButton);
    expect(mockNavigate).toHaveBeenCalledWith("/assessments/a1");
  });
});
