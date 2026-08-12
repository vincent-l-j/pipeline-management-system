import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactsPage from "../ContactsPage";
import { createApiMocks } from "../../test/mocks/api";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string | null;
  last_contacted: string | null;
}

interface MockUser {
  role: string;
}

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

const CONTACTS: Contact[] = [
  {
    id: "c1",
    first_name: "Jane",
    last_name: "Doe",
    role: "CTO",
    email: "jane@example.com",
    last_contacted: "2026-01-01",
  },
];

function setupGet(list: Contact[] = CONTACTS) {
  apiMocks.get.mockResolvedValue({ data: list });
}

describe("ContactsPage", () => {
  beforeEach(() => {
    mockUser = { role: "admin" };
  });

  it("renders first and last name in separate columns", async () => {
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(screen.getByText("Doe")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "First Name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Last Name" }),
    ).toBeInTheDocument();
  });

  it("renders a placeholder when a contact has no last name", async () => {
    setupGet([{ ...CONTACTS[0], last_name: null }]);
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Jane");
    expect(cells[1]).toHaveTextContent("-");
  });

  it("admin sees Add and per-row Remove", async () => {
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(
      screen.getByRole("button", { name: /Add Contact/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("assessor sees Add only, no Remove", async () => {
    mockUser = { role: "assessor" };
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(
      screen.getByRole("button", { name: /Add Contact/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("viewer sees a read-only table (no Add, no Remove)", async () => {
    mockUser = { role: "viewer" };
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(
      screen.queryByRole("button", { name: /Add Contact/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("submitting the Add form posts both name parts and renders the new row", async () => {
    const user = userEvent.setup();
    setupGet([]);
    apiMocks.post.mockResolvedValue({
      data: {
        id: "c2",
        first_name: "New",
        last_name: "Person",
        role: null,
        email: null,
        last_contacted: null,
      },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    await user.type(screen.getByPlaceholderText("First name"), "New");
    await user.type(screen.getByPlaceholderText("Last name"), "Person");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/contacts",
      expect.objectContaining({ first_name: "New", last_name: "Person" }),
    );
    await waitFor(() => {
      expect(screen.getByText("New")).toBeInTheDocument();
    });
    expect(screen.getByText("Person")).toBeInTheDocument();
  });

  it("Create stays disabled until some detail is entered", async () => {
    const user = userEvent.setup();
    setupGet([]);
    render(<ContactsPage />);
    await waitFor(() => screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    // A nameless contact is allowed, so an email alone unlocks Create.
    await user.type(screen.getByPlaceholderText("Email"), "only@example.com");
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("Create stays disabled for whitespace-only input", async () => {
    const user = userEvent.setup();
    setupGet([]);
    render(<ContactsPage />);
    await waitFor(() => screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    await user.type(screen.getByPlaceholderText("First name"), "   ");
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("a contact with no first name posts first_name as null", async () => {
    const user = userEvent.setup();
    setupGet([]);
    apiMocks.post.mockResolvedValue({
      data: {
        id: "c4",
        first_name: null,
        last_name: "Ashworth",
        role: null,
        email: null,
        last_contacted: null,
      },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    await user.type(screen.getByPlaceholderText("Last name"), "Ashworth");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/contacts",
      expect.objectContaining({ first_name: null, last_name: "Ashworth" }),
    );
    await waitFor(() => {
      expect(screen.getByText("Ashworth")).toBeInTheDocument();
    });
  });

  it("a contact with no last name posts last_name as null", async () => {
    const user = userEvent.setup();
    setupGet([]);
    apiMocks.post.mockResolvedValue({
      data: {
        id: "c3",
        first_name: "Mononym",
        last_name: null,
        role: null,
        email: null,
        last_contacted: null,
      },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    await user.type(screen.getByPlaceholderText("First name"), "Mononym");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/contacts",
      expect.objectContaining({ first_name: "Mononym", last_name: null }),
    );
  });

  it("Remove asks for confirmation; confirming deletes and removes the row", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.delete.mockResolvedValue({});
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(apiMocks.delete.mock).toHaveBeenCalledWith("/contacts/c1");
    await waitFor(() => {
      expect(screen.queryByText("Jane")).not.toBeInTheDocument();
    });
  });

  it("cancelling the Remove confirmation does not call the API", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(apiMocks.delete.mock).not.toHaveBeenCalled();
    expect(screen.getByText("Jane")).toBeInTheDocument();
  });

  it("a rejected delete leaves the row present and shows an error", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.delete.mockRejectedValue({
      response: { data: { detail: "Delete failed" } },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => {
      expect(screen.getByText(/Delete failed/)).toBeInTheDocument();
    });
    expect(screen.getByText("Jane")).toBeInTheDocument();
  });

  it("admin sees per-row Edit button", async () => {
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("assessor sees per-row Edit button", async () => {
    mockUser = { role: "assessor" };
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("viewer does not see Edit button", async () => {
    mockUser = { role: "viewer" };
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("Edit opens a form pre-filled with the current values", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CTO")).toBeInTheDocument();
    expect(screen.getByDisplayValue("jane@example.com")).toBeInTheDocument();
  });

  it("saving an edit patches only the changed name part", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({
      data: { ...CONTACTS[0], last_name: "Smith" },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const lastNameInput = screen.getByLabelText("Contact last name");
    await user.clear(lastNameInput);
    await user.type(lastNameInput, "Smith");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/contacts/c1", {
      last_name: "Smith",
    });
    await waitFor(() => {
      expect(screen.getByText("Smith")).toBeInTheDocument();
    });
    expect(screen.queryByText("Doe")).not.toBeInTheDocument();
  });

  it("clearing the last name patches it to null", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({
      data: { ...CONTACTS[0], last_name: null },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Contact last name"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/contacts/c1", {
      last_name: null,
    });
  });

  it("clearing the first name alone still saves", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({
      data: { ...CONTACTS[0], first_name: null },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Contact first name"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/contacts/c1", {
      first_name: null,
    });
  });

  it("emptying both name parts still saves while other fields remain", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({
      data: { ...CONTACTS[0], first_name: null, last_name: null },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Contact first name"));
    await user.clear(screen.getByLabelText("Contact last name"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/contacts/c1", {
      first_name: null,
      last_name: null,
    });
  });

  it("emptying every field blocks the save", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    for (const label of [
      "Contact first name",
      "Contact last name",
      "Contact role",
      "Contact email",
    ]) {
      await user.clear(screen.getByLabelText(label));
    }
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
  });

  it("shows the message from a validation error without blanking the page", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockRejectedValue({
      response: {
        status: 422,
        data: {
          // FastAPI's request-validation shape: detail is a list, not a string.
          detail: [
            {
              type: "value_error",
              loc: ["body", "email"],
              msg: "value is not a valid email address",
            },
          ],
        },
      },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Contact email"));
    await user.type(screen.getByLabelText("Contact email"), "jane@example");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(
        screen.getByText(/value is not a valid email address/),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("reports the status code when the failure carries no detail", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockRejectedValue({
      response: { status: 500, data: "<html>Proxy error</html>" },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Contact first name"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(
        screen.getByText("Failed to update contact (HTTP 500)"),
      ).toBeInTheDocument();
    });
  });

  it("cancelling the edit makes no api.patch call", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const firstNameInput = screen.getByLabelText("Contact first name");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Janet");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
    expect(screen.getByText("Jane")).toBeInTheDocument();
  });

  it("a rejected edit leaves the row unchanged and shows an error", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockRejectedValue({
      response: { data: { detail: "Update failed" } },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const firstNameInput = screen.getByLabelText("Contact first name");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Janet");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.getByText(/Update failed/)).toBeInTheDocument();
    });
    // The underlying row was never mutated: cancelling restores the original value.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(screen.queryByText("Janet")).not.toBeInTheDocument();
  });
});
