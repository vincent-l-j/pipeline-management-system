import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  request_type: string | null;
  next_step: string | null;
  decline_reason: string | null;
  organisation_id: string | null;
  contact_ids: string[];
}

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
    first_name: "Zoe",
    last_name: "Zimmer",
    email: "zoe@example.com",
    organisation_ids: [],
  },
  {
    id: "c2",
    first_name: "Ada",
    last_name: "Adams",
    email: null,
    organisation_ids: [],
  },
  {
    id: "c3",
    first_name: "Not",
    last_name: "Here",
    email: null,
    organisation_ids: [],
  },
];

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
  request_type: null,
  next_step: null,
  decline_reason: null,
  organisation_id: null,
  contact_ids: [],
};

function setupGet(pitch: Pitch = BASE_PITCH, contacts: Contact[] = CONTACTS) {
  apiMocks.get.mockImplementation((url: string) => {
    if (url === "/pitches/42") return Promise.resolve({ data: pitch });
    if (url === "/users") return Promise.resolve({ data: [] });
    if (url === "/contacts") return Promise.resolve({ data: contacts });
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

  it("lists the pitch's contacts, name-sorted, with their emails", async () => {
    setupGet({ ...BASE_PITCH, contact_ids: ["c1", "c2"] });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    const card = screen.getByTestId("pitch-contacts");
    expect(card).toHaveTextContent("Contacts (2)");
    expect(
      within(card)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("Ada Adams"),
      expect.stringContaining("Zoe Zimmer"),
    ]);
    expect(within(card).getByText("zoe@example.com")).toBeInTheDocument();
  });

  it("leaves out the contacts who are not on this pitch", async () => {
    setupGet({ ...BASE_PITCH, contact_ids: ["c1"] });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.queryByText("Not Here")).not.toBeInTheDocument();
  });

  it("says so when a pitch has no contacts", async () => {
    setupGet();
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    const card = screen.getByTestId("pitch-contacts");
    expect(card).toHaveTextContent("Contacts (0)");
    expect(within(card).getByText("No contacts recorded.")).toBeInTheDocument();
  });

  it("names a contact with neither name part rather than showing a blank row", async () => {
    setupGet({ ...BASE_PITCH, contact_ids: ["c9"] }, [
      {
        id: "c9",
        first_name: null,
        last_name: null,
        email: "anon@example.com",
        organisation_ids: [],
      },
    ]);
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.getByText("Unnamed contact")).toBeInTheDocument();
  });

  it("shows them to a viewer too, since reading them is not restricted", async () => {
    mockUser = { role: "viewer" };
    setupGet({ ...BASE_PITCH, contact_ids: ["c1"] });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    const card = screen.getByTestId("pitch-contacts");
    expect(within(card).getByText("Zoe Zimmer")).toBeInTheDocument();
  });

  it("attaches contacts from the card itself, without going to the edit form", async () => {
    const user = userEvent.setup();
    setupGet({ ...BASE_PITCH, contact_ids: ["c1"] });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    const card = screen.getByTestId("pitch-contacts");
    // A button, not a link: nothing here navigates away.
    await user.click(within(card).getByRole("button", { name: "+ Add" }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Add contacts");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("offers a viewer no way to attach one", async () => {
    mockUser = { role: "viewer" };
    setupGet({ ...BASE_PITCH, contact_ids: ["c1"] });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    const card = screen.getByTestId("pitch-contacts");
    expect(
      within(card).queryByRole("button", { name: "+ Add" }),
    ).not.toBeInTheDocument();
  });

  it("shows a newly attached contact in the card without a reload", async () => {
    const user = userEvent.setup();
    setupGet({ ...BASE_PITCH, contact_ids: ["c1"] });
    apiMocks.patch.mockResolvedValue({
      data: { ...BASE_PITCH, contact_ids: ["c1", "c2"] },
    });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    await user.click(screen.getByRole("button", { name: "+ Add" }));
    await user.click(screen.getByRole("combobox", { name: "Add contact" }));
    await user.click(screen.getByRole("option", { name: "Ada Adams" }));
    await user.click(screen.getByRole("button", { name: "Add to pitch" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    const card = screen.getByTestId("pitch-contacts");
    expect(card).toHaveTextContent("Contacts (2)");
    expect(within(card).getByText("Ada Adams")).toBeInTheDocument();
    expect(within(card).getByText("Zoe Zimmer")).toBeInTheDocument();
  });

  it("names a contact created in the dialog once they are on the pitch", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.post.mockResolvedValue({
      data: {
        id: "c9",
        first_name: "Nora",
        last_name: "Nobody",
        email: null,
        organisation_ids: [],
      },
    });
    apiMocks.patch.mockResolvedValue({
      data: { ...BASE_PITCH, contact_ids: ["c9"] },
    });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    await user.click(screen.getByRole("button", { name: "+ Add" }));
    await user.type(
      screen.getByRole("combobox", { name: "Add contact" }),
      "Nora Nobody",
    );
    await user.click(
      screen.getByRole("option", {
        name: 'Add "Nora Nobody" as a new contact',
      }),
    );
    await user.click(screen.getByRole("button", { name: "Add contact" }));
    await waitFor(() => screen.getByTestId("contact-chip"));
    await user.click(screen.getByRole("button", { name: "Add to pitch" }));

    // Named means folded into the directory, not merely sent to the server.
    const card = screen.getByTestId("pitch-contacts");
    await waitFor(() => {
      expect(within(card).getByText("Nora Nobody")).toBeInTheDocument();
    });
    expect(card).toHaveTextContent("Contacts (1)");
  });

  it("leaves the card alone when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    setupGet({ ...BASE_PITCH, contact_ids: ["c1"] });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    await user.click(screen.getByRole("button", { name: "+ Add" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
    expect(screen.getByTestId("pitch-contacts")).toHaveTextContent(
      "Contacts (1)",
    );
  });

  it("reports a failed contact load instead of claiming there are none", async () => {
    apiMocks.get.mockImplementation((url: string) => {
      if (url === "/pitches/42")
        return Promise.resolve({
          data: { ...BASE_PITCH, contact_ids: ["c1"] },
        });
      if (url === "/contacts")
        return Promise.reject(
          Object.assign(new Error("Request failed"), {
            response: { status: 500, data: { detail: "contacts unavailable" } },
          }),
        );
      if (url.startsWith("/organisations/"))
        return Promise.resolve({ data: { name: "Org" } });
      return Promise.resolve({ data: [] });
    });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    const card = screen.getByTestId("pitch-contacts");
    expect(within(card).getByText("contacts unavailable")).toBeInTheDocument();
    expect(
      within(card).queryByText("No contacts recorded."),
    ).not.toBeInTheDocument();
  });

  it("still renders the pitch when the contact load fails", async () => {
    apiMocks.get.mockImplementation((url: string) => {
      if (url === "/pitches/42") return Promise.resolve({ data: BASE_PITCH });
      if (url === "/contacts") return Promise.reject(new Error("boom"));
      if (url.startsWith("/organisations/"))
        return Promise.resolve({ data: { name: "Org" } });
      return Promise.resolve({ data: [] });
    });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    // A failed lookup must not bounce the reader back to the pitch list.
    expect(mockNavigate).not.toHaveBeenCalledWith("/pitches");
  });

  it("renders a Confidential badge and remains openable by a viewer", async () => {
    mockUser = { role: "viewer" };
    setupGet({ ...BASE_PITCH, is_confidential: true });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));
    expect(screen.getByText("Confidential")).toBeInTheDocument();
    expect(screen.getByText("Test Pitch")).toBeInTheDocument();
  });

  it("shows the decline reason beside the stage badge", async () => {
    setupGet({
      ...BASE_PITCH,
      current_stage: "declined",
      decline_reason: "lack_of_rozetta_capacity",
    });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("Lack of Rozetta capacity")).toBeInTheDocument();
  });

  it("shows no reason on a pitch that has none", async () => {
    setupGet({ ...BASE_PITCH, current_stage: "declined" });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(
      screen.queryByText("Lack of Rozetta capacity"),
    ).not.toBeInTheDocument();
  });

  it("shows the decline reason to a viewer", async () => {
    mockUser = { role: "viewer" };
    setupGet({
      ...BASE_PITCH,
      current_stage: "declined",
      decline_reason: "other",
    });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("labels the pitch request in the details card", async () => {
    setupGet({ ...BASE_PITCH, request_type: "sponsored_research" });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.getByText("Pitch Request")).toBeInTheDocument();
    expect(screen.getByText("Sponsored Research")).toBeInTheDocument();
  });

  it("falls back to the raw request it has no label for", async () => {
    // A backend enum added ahead of the frontend degrades to an unpretty string
    // rather than a blank row.
    setupGet({ ...BASE_PITCH, request_type: "brand_new_ask" });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.getByText("brand_new_ask")).toBeInTheDocument();
  });

  it("renders no pitch-request row when the pitch has none", async () => {
    setupGet({ ...BASE_PITCH, request_type: null });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.queryByText("Pitch Request")).not.toBeInTheDocument();
  });

  it("shows the next step in its own callout, above the details card", async () => {
    setupGet({ ...BASE_PITCH, next_step: "Call the CSIRO lead on Friday" });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    const heading = screen.getByText("Next Step");
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText("Call the CSIRO lead on Friday"),
    ).toBeInTheDocument();

    // The callout comes before the stage badge, which opens the details card.
    const badge = screen.getByText("Received");
    expect(heading.compareDocumentPosition(badge)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("preserves the line breaks a next step was typed with", async () => {
    setupGet({ ...BASE_PITCH, next_step: "First line\nSecond line" });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.getByText(/First line/)).toHaveClass("whitespace-pre-line");
  });

  it("renders no next-step section when the pitch has none", async () => {
    setupGet({ ...BASE_PITCH, next_step: null });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.queryByText("Next Step")).not.toBeInTheDocument();
  });

  it("renders no next-step section when the next step is only whitespace", async () => {
    setupGet({ ...BASE_PITCH, next_step: "   " });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.queryByText("Next Step")).not.toBeInTheDocument();
  });

  it("shows the next step to a viewer", async () => {
    mockUser = { role: "viewer" };
    setupGet({ ...BASE_PITCH, next_step: "Visible to all" });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));

    expect(screen.getByText("Visible to all")).toBeInTheDocument();
  });
});

describe("PitchDetailPage contact removal", () => {
  beforeEach(() => {
    mockUser = { role: "admin" };
  });

  async function renderWithContacts(contactIds: string[]) {
    setupGet({ ...BASE_PITCH, contact_ids: contactIds });
    render(<PitchDetailPage />);
    await waitFor(() => screen.getByText("Test Pitch"));
    return screen.getByTestId("pitch-contacts");
  }

  it("detaches a contact from the card itself", async () => {
    const user = userEvent.setup();
    apiMocks.patch.mockResolvedValue({
      data: { ...BASE_PITCH, contact_ids: ["c2"] },
    });
    const card = await renderWithContacts(["c1", "c2"]);

    await user.click(
      within(card).getByRole("button", {
        name: "Remove Zoe Zimmer from this pitch",
      }),
    );

    await waitFor(() => {
      expect(apiMocks.patch.mock).toHaveBeenCalledWith("/pitches/42", {
        contact_ids: ["c2"],
      });
    });
    await waitFor(() => {
      expect(within(card).queryByText("Zoe Zimmer")).not.toBeInTheDocument();
    });
    expect(card).toHaveTextContent("Contacts (1)");
    expect(within(card).getByText("Ada Adams")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("goes back to the empty state when the last contact is removed", async () => {
    const user = userEvent.setup();
    apiMocks.patch.mockResolvedValue({
      data: { ...BASE_PITCH, contact_ids: [] },
    });
    const card = await renderWithContacts(["c1"]);

    await user.click(
      within(card).getByRole("button", {
        name: "Remove Zoe Zimmer from this pitch",
      }),
    );

    await waitFor(() => {
      expect(apiMocks.patch.mock).toHaveBeenCalledWith("/pitches/42", {
        contact_ids: [],
      });
    });
    await waitFor(() => {
      expect(
        within(card).getByText("No contacts recorded."),
      ).toBeInTheDocument();
    });
    expect(card).toHaveTextContent("Contacts (0)");
  });

  it("keeps an attached contact the directory cannot name", async () => {
    const user = userEvent.setup();
    apiMocks.patch.mockResolvedValue({
      data: { ...BASE_PITCH, contact_ids: ["c99"] },
    });
    const card = await renderWithContacts(["c1", "c99"]);

    await user.click(
      within(card).getByRole("button", {
        name: "Remove Zoe Zimmer from this pitch",
      }),
    );

    // c99 stays: a whole-set write must not drop what the card cannot render.
    await waitFor(() => {
      expect(apiMocks.patch.mock).toHaveBeenCalledWith("/pitches/42", {
        contact_ids: ["c99"],
      });
    });
  });

  it("offers a viewer no way to remove one", async () => {
    mockUser = { role: "viewer" };
    const card = await renderWithContacts(["c1"]);

    expect(
      within(card).queryByRole("button", {
        name: "Remove Zoe Zimmer from this pitch",
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps the contact and reports the failure when the removal is rejected", async () => {
    const user = userEvent.setup();
    apiMocks.patch.mockRejectedValue({
      response: { status: 403, data: { detail: "Requires role: assessor" } },
    });
    const card = await renderWithContacts(["c1"]);

    await user.click(
      within(card).getByRole("button", {
        name: "Remove Zoe Zimmer from this pitch",
      }),
    );

    await waitFor(() => {
      expect(
        within(card).getByText("Requires role: assessor"),
      ).toBeInTheDocument();
    });
    expect(within(card).getByText("Zoe Zimmer")).toBeInTheDocument();
    expect(card).toHaveTextContent("Contacts (1)");
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
    expect(
      screen.getByRole("heading", { name: "Test Pitch" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
