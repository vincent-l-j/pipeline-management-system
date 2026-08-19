import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactsPage from "../ContactsPage";
import { createApiMocks } from "../../test/mocks/api";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  organisation_ids: string[];
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
    email: "jane@example.com",
    organisation_ids: [],
  },
];

function organisation(id: string, name: string) {
  return {
    id,
    name,
    org_type: null,
    sector: null,
    state_territory: null,
    website: null,
    abn: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const ORGANISATIONS = [
  organisation("o1", "Zeta Labs"),
  organisation("o2", "Alpha Institute"),
];

/** The page loads contacts and organisations, so the mock answers per URL. */
function setupGet(
  list: Contact[] = CONTACTS,
  orgs: ReturnType<typeof organisation>[] = ORGANISATIONS,
) {
  apiMocks.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === "/organisations" ? orgs : list }),
  );
}

/** Scoped to the picker's popup, so a chip or a table cell of the same name
 *  cannot be mistaken for an option. */
function pickerOption(name: string | RegExp): HTMLElement {
  return within(screen.getByRole("listbox")).getByRole("option", { name });
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

  it("no longer renders the Last Contacted column", async () => {
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(
      screen.queryByRole("columnheader", { name: "Last Contacted" }),
    ).not.toBeInTheDocument();
  });

  it("no longer renders the Role column", async () => {
    setupGet();
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(
      screen.queryByRole("columnheader", { name: "Role" }),
    ).not.toBeInTheDocument();
  });

  it("the Add form offers no Role field", async () => {
    const user = userEvent.setup();
    setupGet([]);
    render(<ContactsPage />);
    await waitFor(() => screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    expect(screen.queryByPlaceholderText("Role")).not.toBeInTheDocument();
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
        email: null,
        organisation_ids: [],
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
        email: null,
        organisation_ids: [],
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
        email: null,
        organisation_ids: [],
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

  // --- Organisation affiliations ---

  const AFFILIATED: Contact[] = [
    { ...CONTACTS[0], organisation_ids: ["o1", "o2"] },
    {
      id: "c2",
      first_name: "Solo",
      last_name: "Worker",
      email: null,
      organisation_ids: ["o1"],
    },
    {
      id: "c3",
      first_name: "Free",
      last_name: "Agent",
      email: null,
      organisation_ids: [],
    },
  ];

  it("lists every organisation a contact belongs to, name-sorted", async () => {
    setupGet(AFFILIATED);
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(
      screen.getByRole("columnheader", { name: "Organisations" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alpha Institute, Zeta Labs")).toBeInTheDocument();
  });

  it("shows a placeholder for a contact with no organisation", async () => {
    setupGet(AFFILIATED);
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Free"));
    const row = screen.getByText("Free").closest("tr");
    expect(row).toHaveTextContent("—");
  });

  it("lists every contact, affiliated or not", async () => {
    setupGet(AFFILIATED);
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("the Add form posts the organisations picked for the new contact", async () => {
    const user = userEvent.setup();
    setupGet([]);
    apiMocks.post.mockResolvedValue({
      data: {
        id: "c9",
        first_name: "Linked",
        last_name: null,
        email: null,
        organisation_ids: ["o2"],
      },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    await user.type(screen.getByPlaceholderText("First name"), "Linked");
    await user.click(
      screen.getByRole("combobox", { name: "Add organisation" }),
    );
    await user.click(pickerOption("Alpha Institute"));
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/contacts",
      expect.objectContaining({ organisation_ids: ["o2"] }),
    );
    await waitFor(() => {
      expect(screen.getByText("Linked").closest("tr")).toHaveTextContent(
        "Alpha Institute",
      );
    });
  });

  it("an organisation alone is enough detail to create a contact", async () => {
    const user = userEvent.setup();
    setupGet([]);
    render(<ContactsPage />);
    await waitFor(() => screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();

    await user.click(
      screen.getByRole("combobox", { name: "Add organisation" }),
    );
    await user.click(pickerOption("Zeta Labs"));
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("adding an affiliation while editing patches the whole set", async () => {
    const user = userEvent.setup();
    setupGet([AFFILIATED[1]]);
    apiMocks.patch.mockResolvedValue({
      data: { ...AFFILIATED[1], organisation_ids: ["o1", "o2"] },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Solo"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(
      screen.getByRole("combobox", { name: "Add organisation" }),
    );
    await user.click(pickerOption("Alpha Institute"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/contacts/c2", {
      organisation_ids: ["o1", "o2"],
    });
    await waitFor(() => {
      expect(
        screen.getByText("Alpha Institute, Zeta Labs"),
      ).toBeInTheDocument();
    });
  });

  it("removing an affiliation while editing patches the remainder", async () => {
    const user = userEvent.setup();
    setupGet([AFFILIATED[0]]);
    apiMocks.patch.mockResolvedValue({
      data: { ...AFFILIATED[0], organisation_ids: ["o1"] },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(
      screen.getByRole("button", { name: "Remove Alpha Institute" }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/contacts/c1", {
      organisation_ids: ["o1"],
    });
  });

  it("an edit that leaves the affiliations alone does not send them", async () => {
    const user = userEvent.setup();
    setupGet([AFFILIATED[0]]);
    apiMocks.patch.mockResolvedValue({
      data: { ...AFFILIATED[0], first_name: "Janet" },
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const firstNameInput = screen.getByLabelText("Contact first name");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Janet");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/contacts/c1", {
      first_name: "Janet",
    });
  });

  it("a viewer sees the affiliations but is offered no picker", async () => {
    mockUser = { role: "viewer" };
    setupGet(AFFILIATED);
    render(<ContactsPage />);
    await waitFor(() => screen.getByText("Jane"));
    expect(screen.getByText("Alpha Institute, Zeta Labs")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Add organisation" }),
    ).not.toBeInTheDocument();
  });

  it("an organisation created from the picker is selected straight away", async () => {
    const user = userEvent.setup();
    setupGet([]);
    apiMocks.post.mockResolvedValue({
      data: organisation("o9", "Brand New Org"),
    });
    render(<ContactsPage />);
    await waitFor(() => screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(screen.getByRole("button", { name: /Add Contact/i }));
    await user.click(
      screen.getByRole("combobox", { name: "Add organisation" }),
    );
    await user.type(
      screen.getByRole("combobox", { name: "Add organisation" }),
      "Brand New Org",
    );
    await user.click(pickerOption('Add "Brand New Org"'));

    await user.click(
      await screen.findByRole("button", { name: "Add organisation" }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("organisation-chip")).toHaveTextContent(
        "Brand New Org",
      );
    });
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/organisations",
      expect.objectContaining({ name: "Brand New Org" }),
    );
  });
});
