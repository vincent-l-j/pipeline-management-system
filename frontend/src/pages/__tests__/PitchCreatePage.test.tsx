import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PitchCreatePage from "../PitchCreatePage";
import { createApiMocks } from "../../test/mocks/api";

interface MockUser {
  role: string;
}

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => mockNavigate };
});

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const apiMocks = createApiMocks();

let mockUser: MockUser = { role: "assessor" };
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("../../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("PitchCreatePage", () => {
  beforeEach(() => {
    mockUser = { role: "assessor" };
    apiMocks.get.mockResolvedValue({ data: [] });
  });

  it("resolves lead names via /users/directory, not the admin /users listing", async () => {
    render(<PitchCreatePage />);
    await waitFor(() => {
      expect(
        apiMocks.get.mock.mock.calls.map((c: unknown[]) => c[0]),
      ).toContain("/users/directory");
    });
    // The sensitive admin listing is never called from the create form.
    expect(
      apiMocks.get.mock.mock.calls.map((c: unknown[]) => c[0]),
    ).not.toContain("/users");
  });

  it("renders the create form for an assessor", async () => {
    render(<PitchCreatePage />);
    await waitFor(() => {
      expect(screen.getByText("New Pitch")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Add Pitch/i }),
    ).toBeInTheDocument();
  });

  // The source, funding and domain vocabularies are pinned where they are now
  // rendered, in PitchFormFields.test.tsx.

  it("renders the shared pitch fields, including the submission date", async () => {
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Submission Date/)).toBeInTheDocument();
  });

  it("POSTs the entered pitch and navigates to the new pitch", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({ data: { id: "99" } });
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.type(screen.getByLabelText(/Title/), "Soil Sensors");
    await user.click(screen.getByRole("button", { name: /Add Pitch/i }));

    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/pitches",
      expect.objectContaining({ title: "Soil Sensors" }),
    );
    const postCalls = apiMocks.post.mock.mock.calls as unknown[][];
    expect(postCalls[0][1]).toHaveProperty("submission_date");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/pitches/99");
    });
  });

  it("renders a validation error's messages rather than an object", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockRejectedValue({
      response: { status: 422, data: { detail: [{ msg: "title too short" }] } },
    });
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.type(screen.getByLabelText(/Title/), "S");
    await user.click(screen.getByRole("button", { name: /Add Pitch/i }));

    await waitFor(() => {
      expect(screen.getByText("title too short")).toBeInTheDocument();
    });
  });
});
