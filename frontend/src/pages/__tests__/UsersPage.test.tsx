import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsersPage from "../UsersPage";
import { createApiMocks } from "../../test/mocks/api";

interface User {
  id: string;
  display_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface MockUser {
  role: string;
}

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), patch: vi.fn() },
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

vi.mock("../../components/PageHeader", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

const mockUsers: User[] = [
  {
    id: "1",
    display_name: "Admin User",
    email: "admin@test.com",
    role: "admin",
    is_active: true,
    created_at: "2024-01-01",
  },
  {
    id: "2",
    display_name: "Assessor User",
    email: "assessor@test.com",
    role: "assessor",
    is_active: true,
    created_at: "2024-01-01",
  },
  {
    id: "3",
    display_name: "Viewer User",
    email: "viewer@test.com",
    role: "viewer",
    is_active: false,
    created_at: "2024-01-01",
  },
];

describe("UsersPage", () => {
  beforeEach(() => {
    apiMocks.get.mockResolvedValue({ data: mockUsers });
    mockUser = { role: "admin" };
  });

  it("renders the page header", () => {
    render(<UsersPage />);
    expect(screen.getByText("User Management")).toBeInTheDocument();
  });

  it("lists all users with their details", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
      expect(screen.getByText("admin@test.com")).toBeInTheDocument();
      expect(screen.getByText("Assessor User")).toBeInTheDocument();
      expect(screen.getByText("assessor@test.com")).toBeInTheDocument();
      expect(screen.getByText("Viewer User")).toBeInTheDocument();
      expect(screen.getByText("viewer@test.com")).toBeInTheDocument();
    });
  });

  it("shows Edit button for each user", async () => {
    render(<UsersPage />);

    await waitFor(() => {
      const editButtons = screen.getAllByRole("button", { name: "Edit" });
      expect(editButtons.length).toBe(mockUsers.length);
    });
  });

  it("opens edit form when Edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/change role/i)).toBeInTheDocument();
    });
  });

  it("allows changing a user role", async () => {
    const user = userEvent.setup();
    apiMocks.patch.mockResolvedValue({
      data: { ...mockUsers[1], role: "admin" },
    });

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Assessor User")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[1]);

    await waitFor(() => {
      const roleSelect = screen.getByDisplayValue("assessor");
      expect(roleSelect).toBeInTheDocument();
    });

    const roleSelect = screen.getByDisplayValue("assessor");
    await user.selectOptions(roleSelect, "admin");

    const saveButton = screen.getAllByRole("button", { name: "Save" })[0];
    await user.click(saveButton);

    await waitFor(() => {
      expect(apiMocks.patch.mock).toHaveBeenCalledWith("/users/2", {
        role: "admin",
      });
    });
  });

  it("closes edit form on Cancel without saving", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/change role/i)).toBeInTheDocument();
    });

    const cancelButton = screen.getAllByRole("button", { name: "Cancel" })[0];
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/change role/i)).not.toBeInTheDocument();
    });

    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
  });

  it("shows error message on patch failure", async () => {
    const user = userEvent.setup();
    apiMocks.patch.mockRejectedValue({
      response: { data: { detail: "Permission denied" } },
    });

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    await waitFor(() => {
      const roleSelect = screen.getByDisplayValue("admin");
      expect(roleSelect).toBeInTheDocument();
    });

    const roleSelect = screen.getByDisplayValue("admin");
    await user.selectOptions(roleSelect, "viewer");

    const saveButton = screen.getAllByRole("button", { name: "Save" })[0];
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });
});
