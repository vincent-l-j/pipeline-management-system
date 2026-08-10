import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PitchCreatePage from "../PitchCreatePage";
import { createApiMocks } from "../../test/mocks/api";

interface MockUser {
  role: string;
}

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, useNavigate: () => mockNavigate } as unknown;
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
});
