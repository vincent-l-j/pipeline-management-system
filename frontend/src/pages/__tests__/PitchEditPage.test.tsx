import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PitchEditPage from "../PitchEditPage";
import { createApiMocks } from "../../test/mocks/api";

interface Pitch {
  id: string;
  title: string;
  short_description: string;
  submission_date: string | null;
  source: string | null;
  funding_pathway: string | null;
  domain_tags: string | null;
  masterplan_alignment: string | null;
  is_confidential: boolean;
  organisation_id: string | null;
  lead_id: string | null;
  contact_ids: string[];
  current_stage: string;
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
    first_name: "Ada",
    last_name: "Adams",
    email: null,
    organisation_ids: [],
  },
  {
    id: "c2",
    first_name: "Bob",
    last_name: "Brown",
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
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="redirect">redirect:{to}</div>
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

const PITCH: Pitch = {
  id: "42",
  title: "Original Title",
  short_description: "Original description",
  submission_date: "2026-01-01",
  source: "referral",
  funding_pathway: "rdti",
  domain_tags: "climate,health",
  masterplan_alignment: "Aligned",
  is_confidential: false,
  organisation_id: "",
  lead_id: "",
  contact_ids: ["c1"],
  current_stage: "initial_screen",
};

function setupGet(pitch: Pitch = PITCH) {
  apiMocks.get.mockImplementation((url: string) => {
    if (url === "/pitches/42") return Promise.resolve({ data: pitch });
    if (url === "/organisations") return Promise.resolve({ data: [] });
    if (url === "/contacts") return Promise.resolve({ data: CONTACTS });
    if (url === "/users/directory") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
}

describe("PitchEditPage", () => {
  beforeEach(() => {
    mockUser = { role: "admin" };
  });

  it("fetches the pitch and pre-fills the form", async () => {
    setupGet();
    render(<PitchEditPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Original Title")).toBeInTheDocument();
    });
    expect(
      screen.getByDisplayValue("Original description"),
    ).toBeInTheDocument();
  });

  it("does not offer a pipeline-stage selector", async () => {
    setupGet();
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));
    expect(screen.queryByLabelText(/stage/i)).not.toBeInTheDocument();
  });

  it("saving PATCHes the pitch then navigates to the detail route", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({
      data: { ...PITCH, title: "New Title" },
    });
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    const titleInput = screen.getByDisplayValue("Original Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith(
      "/pitches/42",
      expect.objectContaining({ title: "New Title" }),
    );
    // Stage is never sent from the edit form.
    const patchCalls = apiMocks.patch.mock.mock.calls as unknown[][];
    expect(patchCalls[0][1]).not.toHaveProperty("current_stage");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/pitches/42");
    });
  });

  it("Cancel returns to the detail route without calling the API", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/pitches/42");
  });

  // The source, funding and domain vocabularies are pinned where they are now
  // rendered, in PitchFormFields.test.tsx.

  it("resolves lead names via /users/directory, not the admin /users listing", async () => {
    setupGet();
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    const requested = apiMocks.get.mock.mock.calls.map(
      (c: unknown[]) => c[0],
    ) as string[];
    expect(requested).toContain("/users/directory");
    // The sensitive admin listing is never called from the edit form.
    expect(requested).not.toContain("/users");
  });

  it("offers a submission-date field pre-filled from the pitch", async () => {
    setupGet();
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    expect(screen.getByLabelText(/Submission Date/)).toHaveValue("2026-01-01");
  });

  it("sends an edited submission date when saving", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({ data: PITCH });
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    await user.clear(screen.getByLabelText(/Submission Date/));
    await user.type(screen.getByLabelText(/Submission Date/), "2026-03-15");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith(
      "/pitches/42",
      expect.objectContaining({ submission_date: "2026-03-15" }),
    );
  });

  it("clears the submission date as null rather than a blank string", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({ data: PITCH });
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    await user.clear(screen.getByLabelText(/Submission Date/));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith(
      "/pitches/42",
      expect.objectContaining({ submission_date: null }),
    );
  });

  it("pre-fills the contacts already on the pitch", async () => {
    setupGet();
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    expect(screen.getByTestId("contact-chip")).toHaveTextContent("Ada Adams");
    // Somebody who isn't on this pitch is offered, not shown as attached.
    expect(screen.queryByText("Bob Brown")).not.toBeInTheDocument();
  });

  it("sends the contacts as edited, added and removed", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({ data: PITCH });
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    await user.click(screen.getByRole("combobox", { name: "Add contact" }));
    await user.click(screen.getByRole("option", { name: "Bob Brown" }));
    await user.click(screen.getByRole("button", { name: "Remove Ada Adams" }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith(
      "/pitches/42",
      expect.objectContaining({ contact_ids: ["c2"] }),
    );
  });

  it("unlinking the last contact sends an empty list, not an omitted field", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockResolvedValue({ data: PITCH });
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    await user.click(screen.getByRole("button", { name: "Remove Ada Adams" }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith(
      "/pitches/42",
      expect.objectContaining({ contact_ids: [] }),
    );
  });

  it("creates a contact inline and adds them to the pitch's existing ones", async () => {
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
    apiMocks.patch.mockResolvedValue({ data: PITCH });
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    const picker = screen.getByRole("combobox", { name: "Add contact" });
    await user.click(picker);
    await user.type(picker, "Nora Nobody");
    await user.click(
      screen.getByRole("option", {
        name: 'Add "Nora Nobody" as a new contact',
      }),
    );
    await user.click(screen.getByRole("button", { name: /^Add contact$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(apiMocks.patch.mock).toHaveBeenCalledWith(
      "/pitches/42",
      expect.objectContaining({ contact_ids: ["c1", "c9"] }),
    );
  });

  it("does not save the pitch while the contact dialog is open", async () => {
    const user = userEvent.setup();
    setupGet();
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    const picker = screen.getByRole("combobox", { name: "Add contact" });
    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "Add a new contact" }));

    // A submit that arrives from anywhere while the dialog is up is ignored:
    // the dialog is a decision in progress, not a pitch to save.
    const form = screen.getByRole("button", { name: /save/i }).closest("form");
    if (!form) throw new Error("the edit page rendered no form");
    fireEvent.submit(form);

    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("copes with a pitch that has no contacts", async () => {
    setupGet({ ...PITCH, contact_ids: [] });
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    expect(screen.getByText("No contacts")).toBeInTheDocument();
    expect(screen.queryByTestId("contact-chip")).not.toBeInTheDocument();
  });

  it("renders a validation error's messages rather than an object", async () => {
    const user = userEvent.setup();
    setupGet();
    apiMocks.patch.mockRejectedValue({
      response: { status: 422, data: { detail: [{ msg: "title too short" }] } },
    });
    render(<PitchEditPage />);
    await waitFor(() => screen.getByDisplayValue("Original Title"));

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText("title too short")).toBeInTheDocument();
    });
  });

  it("redirects a viewer away from the edit route without rendering the form", async () => {
    mockUser = { role: "viewer" };
    setupGet();
    render(<PitchEditPage />);
    await waitFor(() => screen.getByTestId("redirect"));
    expect(screen.getByTestId("redirect")).toHaveTextContent("/pitches/42");
    expect(
      screen.queryByDisplayValue("Original Title"),
    ).not.toBeInTheDocument();
  });
});
