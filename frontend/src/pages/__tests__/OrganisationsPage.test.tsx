import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrganisationsPage from "../OrganisationsPage";
import { createApiMocks } from "../../test/mocks/api";

interface Organisation {
  id: string;
  name: string;
  org_type: string | null;
  sector: string | null;
  state_territory: string | null;
  website: string | null;
  abn: string | null;
  notes: string | null;
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

// Layout renders Sidebar (router + auth); stub it to isolate the page.
vi.mock("../../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const ORGS: Organisation[] = [
  {
    id: "o1",
    name: "Soil Tech Labs",
    org_type: null,
    sector: "Agriculture",
    state_territory: "NSW",
    website: "https://soil.example",
    abn: null,
    notes: null,
  },
];

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  organisation_ids: string[];
}

const CONTACTS: Contact[] = [
  {
    id: "c1",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    organisation_ids: ["o1"],
  },
  {
    id: "c2",
    first_name: "Sam",
    last_name: "Stone",
    email: null,
    organisation_ids: ["o1", "o2"],
  },
  {
    id: "c3",
    first_name: "Free",
    last_name: "Agent",
    email: null,
    organisation_ids: [],
  },
];

/** The page loads organisations and contacts, so the mock answers per URL. */
function setupGet(list: Organisation[] = ORGS, people: Contact[] = CONTACTS) {
  apiMocks.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === "/contacts" ? people : list }),
  );
}

/** Scoped to the people picker's popup: the org-type <select> in the add/edit
 *  forms has options of the same role. */
function pickerOption(name: string | RegExp): HTMLElement {
  return within(screen.getByRole("listbox")).getByRole("option", { name });
}

describe("OrganisationsPage", () => {
  beforeEach(() => {
    mockUser = { role: "admin" };
  });

  it("admin sees Add and per-row Remove", async () => {
    setupGet();
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    expect(
      screen.getByRole("button", { name: /Add Organisation/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("assessor sees Add only, no Remove", async () => {
    mockUser = { role: "assessor" };
    setupGet();
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    expect(
      screen.getByRole("button", { name: /Add Organisation/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("viewer sees a read-only table (no Add, no Remove)", async () => {
    mockUser = { role: "viewer" };
    setupGet();
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    expect(
      screen.queryByRole("button", { name: /Add Organisation/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });

  it("submitting the Add form posts and renders the new row", async () => {
    const user = userEvent.setup();
    setupGet([]);
    apiMocks.post.mockResolvedValue({
      data: {
        id: "o2",
        name: "New Org",
        org_type: null,
        sector: "Energy",
        state_territory: null,
        website: null,
        abn: null,
        notes: null,
      },
    });
    render(<OrganisationsPage />);
    await waitFor(() =>
      screen.getByRole("button", { name: /Add Organisation/i }),
    );
    await user.click(screen.getByRole("button", { name: /Add Organisation/i }));
    await user.type(
      screen.getByPlaceholderText(/Organisation name/i),
      "New Org",
    );
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/organisations",
      expect.objectContaining({ name: "New Org" }),
    );
    await waitFor(() => {
      expect(screen.getByText("New Org")).toBeInTheDocument();
    });
  });

  it("Add form includes all optional fields", async () => {
    const user = userEvent.setup();
    setupGet([]);
    apiMocks.post.mockResolvedValue({
      data: {
        id: "o2",
        name: "TechCorp",
        org_type: "startup",
        sector: "Technology",
        state_territory: "NSW",
        website: "https://techcorp.example",
        abn: "12345678901",
        notes: "A tech startup",
      },
    });
    render(<OrganisationsPage />);
    await waitFor(() =>
      screen.getByRole("button", { name: /Add Organisation/i }),
    );
    await user.click(screen.getByRole("button", { name: /Add Organisation/i }));
    await user.type(
      screen.getByPlaceholderText(/Organisation name/i),
      "TechCorp",
    );
    await user.selectOptions(screen.getByDisplayValue(/Type/), "startup");
    await user.type(screen.getByPlaceholderText(/Sector/), "Technology");
    await user.type(screen.getByPlaceholderText(/State\/Territory/), "NSW");
    await user.type(
      screen.getByPlaceholderText(/Website/),
      "https://techcorp.example",
    );
    await user.type(screen.getByPlaceholderText(/ABN/), "12345678901");
    await user.type(screen.getByPlaceholderText(/Notes/), "A tech startup");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/organisations",
      expect.objectContaining({
        name: "TechCorp",
        org_type: "startup",
        sector: "Technology",
        state_territory: "NSW",
        website: "https://techcorp.example",
        abn: "12345678901",
        notes: "A tech startup",
      }),
    );
  });

  it("Remove asks for confirmation; confirming deletes and removes the row", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.delete.mockResolvedValue({});
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(apiMocks.delete.mock).toHaveBeenCalledWith("/organisations/o1");
    await waitFor(() => {
      expect(screen.queryByText("Soil Tech Labs")).not.toBeInTheDocument();
    });
  });

  it("cancelling the Remove confirmation does not call the API", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(apiMocks.delete.mock).not.toHaveBeenCalled();
    expect(screen.getByText("Soil Tech Labs")).toBeInTheDocument();
  });

  it("a rejected delete leaves the row present and shows an error", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.delete.mockRejectedValue({
      response: { data: { detail: "Delete failed" } },
    });
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => {
      expect(screen.getByText(/Delete failed/)).toBeInTheDocument();
    });
    expect(screen.getByText("Soil Tech Labs")).toBeInTheDocument();
  });

  it("admin and assessor see per-row Edit; viewer does not", async () => {
    setupGet();
    const { unmount } = render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    unmount();

    mockUser = { role: "assessor" };
    setupGet();
    const second = render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    second.unmount();

    mockUser = { role: "viewer" };
    setupGet();
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("Edit opens a form pre-filled with all current values", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByDisplayValue("Soil Tech Labs")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Agriculture")).toBeInTheDocument();
    expect(screen.getByDisplayValue("NSW")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://soil.example"),
    ).toBeInTheDocument();
  });

  it("saving an edit patches the changed fields and updates the row in place", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({
      data: { ...ORGS[0], sector: "Energy" },
    });
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const sectorInput = screen.getByDisplayValue("Agriculture");
    await user.clear(sectorInput);
    await user.type(sectorInput, "Energy");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/organisations/o1", {
      sector: "Energy",
    });
    await waitFor(() => {
      expect(screen.getByText("Energy")).toBeInTheDocument();
    });
    expect(screen.queryByText("Agriculture")).not.toBeInTheDocument();
  });

  it("saving an edit with optional fields included patches all changed fields", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({
      data: { ...ORGS[0], org_type: "startup", abn: "98765432100" },
    });
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const typeSelect = screen.getByDisplayValue(/Type/i);
    const abnInput = screen.getByPlaceholderText(/ABN/);
    await user.selectOptions(typeSelect, "startup");
    await user.type(abnInput, "98765432100");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(apiMocks.patch.mock).toHaveBeenCalledWith(
      "/organisations/o1",
      expect.objectContaining({ org_type: "startup", abn: "98765432100" }),
    );
  });

  it("cancelling the edit makes no api.patch call", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const sectorInput = screen.getByDisplayValue("Agriculture");
    await user.clear(sectorInput);
    await user.type(sectorInput, "Energy");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
    expect(screen.getByText("Agriculture")).toBeInTheDocument();
  });

  it("a rejected edit leaves the row unchanged and shows an error", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockRejectedValue({
      response: { data: { detail: "Update failed" } },
    });
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const sectorInput = screen.getByDisplayValue("Agriculture");
    await user.clear(sectorInput);
    await user.type(sectorInput, "Energy");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.getByText(/Update failed/)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Agriculture")).toBeInTheDocument();
    expect(screen.queryByText("Energy")).not.toBeInTheDocument();
  });

  // --- The people at each organisation ---

  const TWO_ORGS: Organisation[] = [
    ORGS[0],
    { ...ORGS[0], id: "o2", name: "Wind Co", sector: "Energy" },
    { ...ORGS[0], id: "o3", name: "Empty Trust", sector: "Nobody" },
  ];

  function showPeople(name: string) {
    return screen.getByRole("button", { name: `Show people at ${name}` });
  }

  /** Matches whichever way round the toggle currently reads. */
  function peopleToggle(name: string) {
    return screen.getByRole("button", {
      name: new RegExp(`people at ${name}$`),
    });
  }

  it("counts the people at each organisation", async () => {
    setupGet(TWO_ORGS);
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    expect(
      screen.getByRole("columnheader", { name: "People" }),
    ).toBeInTheDocument();
    expect(showPeople("Soil Tech Labs")).toHaveTextContent("2");
    expect(showPeople("Wind Co")).toHaveTextContent("1");
    expect(showPeople("Empty Trust")).toHaveTextContent("0");
  });

  it("expanding an organisation lists its people", async () => {
    const user = userEvent.setup();
    setupGet(TWO_ORGS);
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();

    await user.click(showPeople("Soil Tech Labs"));
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Sam Stone")).toBeInTheDocument();
    // Somebody else's affiliation stays out of it.
    expect(screen.queryByText("Free Agent")).not.toBeInTheDocument();
  });

  it("collapsing hides them again", async () => {
    const user = userEvent.setup();
    setupGet(TWO_ORGS);
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(showPeople("Soil Tech Labs"));
    await user.click(
      screen.getByRole("button", { name: "Hide people at Soil Tech Labs" }),
    );
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
  });

  it("says so when an organisation has nobody", async () => {
    const user = userEvent.setup();
    setupGet(TWO_ORGS);
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Empty Trust"));
    await user.click(showPeople("Empty Trust"));
    expect(screen.getByText("No contacts here yet.")).toBeInTheDocument();
  });

  it("adding a person here patches that contact's affiliations", async () => {
    const user = userEvent.setup();
    setupGet(TWO_ORGS);
    apiMocks.patch.mockResolvedValue({
      data: { ...CONTACTS[2], organisation_ids: ["o1"] },
    });
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(showPeople("Soil Tech Labs"));
    await user.click(screen.getByRole("combobox", { name: "Add person" }));
    await user.click(pickerOption(/Free Agent/));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/contacts/c3", {
      organisation_ids: ["o1"],
    });
    await waitFor(() => {
      expect(screen.getByText("Free Agent")).toBeInTheDocument();
    });
    expect(peopleToggle("Soil Tech Labs")).toHaveTextContent("3");
  });

  it("offers only the contacts who are not already here", async () => {
    const user = userEvent.setup();
    setupGet(TWO_ORGS);
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(showPeople("Soil Tech Labs"));
    await user.click(screen.getByRole("combobox", { name: "Add person" }));
    expect(pickerOption(/Free Agent/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("listbox")).queryByRole("option", {
        name: /Jane Doe/,
      }),
    ).not.toBeInTheDocument();
  });

  it("removing a person here keeps their other affiliations", async () => {
    const user = userEvent.setup();
    setupGet(TWO_ORGS);
    apiMocks.patch.mockResolvedValue({
      data: { ...CONTACTS[1], organisation_ids: ["o2"] },
    });
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(showPeople("Soil Tech Labs"));
    await user.click(
      screen.getByRole("button", {
        name: "Remove Sam Stone from Soil Tech Labs",
      }),
    );

    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/contacts/c2", {
      organisation_ids: ["o2"],
    });
    await waitFor(() => {
      expect(screen.queryByText("Sam Stone")).not.toBeInTheDocument();
    });
    // Still counted at the other organisation.
    expect(showPeople("Wind Co")).toHaveTextContent("1");
  });

  it("a rejected unlink shows an error and leaves the person listed", async () => {
    const user = userEvent.setup();
    setupGet(TWO_ORGS);
    apiMocks.patch.mockRejectedValue({
      response: { data: { detail: "Unlink failed" } },
    });
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(showPeople("Soil Tech Labs"));
    await user.click(
      screen.getByRole("button", {
        name: "Remove Jane Doe from Soil Tech Labs",
      }),
    );
    await waitFor(() => {
      expect(screen.getByText(/Unlink failed/)).toBeInTheDocument();
    });
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("a viewer sees who is here but cannot change it", async () => {
    const user = userEvent.setup();
    mockUser = { role: "viewer" };
    setupGet(TWO_ORGS);
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(showPeople("Soil Tech Labs"));
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Add person" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Remove Jane Doe from Soil Tech Labs",
      }),
    ).not.toBeInTheDocument();
  });

  it("a nameless contact is still listed, by email", async () => {
    const user = userEvent.setup();
    setupGet(TWO_ORGS, [
      {
        id: "c9",
        first_name: null,
        last_name: null,
        email: "anon@example.com",
        organisation_ids: ["o1"],
      },
    ]);
    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText("Soil Tech Labs"));
    await user.click(showPeople("Soil Tech Labs"));
    expect(screen.getByText("Unnamed contact")).toBeInTheDocument();
    expect(screen.getByText("anon@example.com")).toBeInTheDocument();
  });
});
