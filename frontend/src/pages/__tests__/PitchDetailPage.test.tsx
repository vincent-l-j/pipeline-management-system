import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PitchDetailPage from "../PitchDetailPage";
import { createApiMocks } from "../../test/mocks/api";

interface Pitch {
  id: string;
  title: string;
  short_description: string;
  current_stage: string;
  is_confidential: boolean;
  domain_tags: string | null;
  lead_id: string | null;
  source: string | null;
  funding_pathway: string | null;
  submission_date: string | null;
  masterplan_alignment: string | null;
  organisation_id: string | null;
}

interface MockUser {
  role: string;
}

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useParams: () => ({ pitchId: "42" }),
    useNavigate: () => mockNavigate,
    Link: ({
      to,
      children,
      ...rest
    }: {
      to: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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
vi.mock("../../components/pitch/ActivityTimeline", () => ({
  default: () => <div />,
}));
vi.mock("../../components/pitch/FileLinks", () => ({ default: () => <div /> }));

const BASE_PITCH: Pitch = {
  id: "42",
  title: "Test Pitch",
  short_description: "A description",
  current_stage: "received",
  is_confidential: false,
  domain_tags: null,
  lead_id: null,
  source: null,
  funding_pathway: null,
  submission_date: null,
  masterplan_alignment: null,
  organisation_id: null,
};

function setupGet(pitch: Pitch = BASE_PITCH) {
  apiMocks.get.mockImplementation((url: string) => {
    if (url === "/pitches/42") return Promise.resolve({ data: pitch });
    if (url === "/users") return Promise.resolve({ data: [] });
    if (url.startsWith("/meetings")) return Promise.resolve({ data: [] });
    if (url.startsWith("/assessments")) return Promise.resolve({ data: [] });
    if (url.startsWith("/organisations/"))
      return Promise.resolve({ data: { name: "Org" } });
    return Promise.resolve({ data: [] });
  });
}

describe("PitchDetailPage", () => {
  beforeEach(() => {
    mockUser = { role: "admin" };
  });

  it("shows an Edit link to the edit route for admin", async () => {
    setupGet();
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));
    const edit = screen.getByRole("link", { name: "Edit" });
    expect(edit).toHaveAttribute("href", "/pitches/42/edit");
  });

  it("shows an Edit link for assessor", async () => {
    mockUser = { role: "assessor" };
    setupGet();
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
  });

  it("hides the Edit link for viewer", async () => {
    mockUser = { role: "viewer" };
    setupGet();
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));
    expect(
      screen.queryByRole("link", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("renders a Confidential badge and remains openable by a viewer", async () => {
    mockUser = { role: "viewer" };
    setupGet({ ...BASE_PITCH, is_confidential: true });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));
    // Viewer can still read the pitch; the flag is a visual marker only.
    expect(screen.getByText("Confidential")).toBeInTheDocument();
    expect(screen.getByText("Test Pitch")).toBeInTheDocument();
  });
});

describe("PitchDetailPage delete", () => {
  beforeEach(() => {
    mockUser = { role: "admin" };
  });

  async function renderAsAdmin() {
    setupGet();
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));
  }

  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await renderAsAdmin();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    return screen.getByRole("dialog");
  }

  it("shows a Delete control for admin", async () => {
    await renderAsAdmin();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("hides the Delete control for assessor", async () => {
    mockUser = { role: "assessor" };
    setupGet();
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("hides the Delete control for viewer", async () => {
    mockUser = { role: "viewer" };
    setupGet();
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog without calling the API", async () => {
    const user = userEvent.setup();
    await openDialog(user);
    expect(apiMocks.delete.mock).not.toHaveBeenCalled();
  });

  it("deletes and navigates to the pitch list once the title is typed", async () => {
    const user = userEvent.setup();
    apiMocks.delete.mockResolvedValue({ data: { detail: "Pitch deleted" } });
    await openDialog(user);

    await user.type(screen.getByLabelText(/type/i), "Test Pitch");
    await user.click(screen.getByRole("button", { name: "Delete pitch" }));

    await waitFor(() => {
      expect(apiMocks.delete.mock).toHaveBeenCalledWith("/pitches/42");
    });
    expect(mockNavigate).toHaveBeenCalledWith("/pitches");
  });

  it("does not call the API when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiMocks.delete.mock).not.toHaveBeenCalled();
  });

  it("keeps the pitch and shows the error when the delete is rejected", async () => {
    const user = userEvent.setup();
    apiMocks.delete.mockRejectedValue({
      response: { status: 403, data: { detail: "Requires role: admin" } },
    });
    await openDialog(user);

    await user.type(screen.getByLabelText(/type/i), "Test Pitch");
    await user.click(screen.getByRole("button", { name: "Delete pitch" }));

    await waitFor(() => {
      expect(screen.getByText("Requires role: admin")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalledWith("/pitches");
    // The pitch is still on screen behind the still-open dialog.
    expect(
      screen.getByRole("heading", { name: "Test Pitch" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
