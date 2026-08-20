import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

  it("POSTs the contacts picked for the pitch", async () => {
    const user = userEvent.setup();
    apiMocks.get.mockImplementation((url: string) => {
      if (url === "/contacts")
        return Promise.resolve({
          data: [
            {
              id: "c1",
              first_name: "Ada",
              last_name: "Adams",
              email: null,
              organisation_ids: [],
            },
          ],
        });
      return Promise.resolve({ data: [] });
    });
    apiMocks.post.mockResolvedValue({ data: { id: "99" } });
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.type(screen.getByLabelText(/Title/), "Soil Sensors");
    await user.click(screen.getByRole("combobox", { name: "Add contact" }));
    await user.click(screen.getByRole("option", { name: "Ada Adams" }));
    await user.click(screen.getByRole("button", { name: /Add Pitch/i }));

    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/pitches",
      expect.objectContaining({ contact_ids: ["c1"] }),
    );
  });

  it("creates a contact inline, attaches them, and keeps what was already typed", async () => {
    const user = userEvent.setup();
    apiMocks.get.mockResolvedValue({ data: [] });
    apiMocks.post.mockImplementation((url: string) =>
      url === "/contacts"
        ? Promise.resolve({
            data: {
              id: "c9",
              first_name: "Nora",
              last_name: "Nobody",
              email: null,
              organisation_ids: [],
            },
          })
        : Promise.resolve({ data: { id: "99" } }),
    );
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.type(screen.getByLabelText(/Title/), "Soil Sensors");

    const picker = screen.getByRole("combobox", { name: "Add contact" });
    await user.click(picker);
    await user.type(picker, "Nora Nobody");
    await user.click(
      screen.getByRole("option", {
        name: 'Add "Nora Nobody" as a new contact',
      }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Add contact$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/contacts",
      expect.objectContaining({ first_name: "Nora", last_name: "Nobody" }),
    );
    // Attached to the pitch, and nothing already typed was lost.
    expect(screen.getByTestId("contact-chip")).toHaveTextContent("Nora Nobody");
    expect(screen.getByLabelText(/Title/)).toHaveValue("Soil Sensors");

    // And they are who gets saved.
    await user.click(screen.getByRole("button", { name: /Add Pitch/i }));
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/pitches",
      expect.objectContaining({ contact_ids: ["c9"] }),
    );
  });

  it("keeps the contacts already picked when another is created", async () => {
    const user = userEvent.setup();
    apiMocks.get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === "/contacts"
            ? [
                {
                  id: "c1",
                  first_name: "Ada",
                  last_name: "Adams",
                  email: null,
                  organisation_ids: [],
                },
              ]
            : [],
      }),
    );
    apiMocks.post.mockResolvedValue({
      data: {
        id: "c9",
        first_name: "Nora",
        last_name: "Nobody",
        email: null,
        organisation_ids: [],
      },
    });
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    const picker = screen.getByRole("combobox", { name: "Add contact" });
    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "Ada Adams" }));

    const reopened = screen.getByRole("combobox", { name: "Add contact" });
    await user.click(reopened);
    await user.type(reopened, "Nora Nobody");
    await user.click(
      screen.getByRole("option", {
        name: 'Add "Nora Nobody" as a new contact',
      }),
    );
    await user.click(screen.getByRole("button", { name: /^Add contact$/i }));

    await waitFor(() => {
      expect(screen.getAllByTestId("contact-chip")).toHaveLength(2);
    });
    expect(
      screen.getAllByTestId("contact-chip").map((chip) => chip.textContent),
    ).toEqual([
      expect.stringContaining("Ada Adams"),
      expect.stringContaining("Nora Nobody"),
    ]);
  });

  it("Enter in the contact dialog commits the contact, not the pitch", async () => {
    const user = userEvent.setup();
    apiMocks.get.mockResolvedValue({ data: [] });
    apiMocks.post.mockImplementation((url: string) =>
      url === "/contacts"
        ? Promise.resolve({
            data: {
              id: "c9",
              first_name: "Nora",
              last_name: "Nobody",
              email: null,
              organisation_ids: [],
            },
          })
        : Promise.resolve({ data: { id: "99" } }),
    );
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));
    await user.type(screen.getByLabelText(/Title/), "Soil Sensors");

    const picker = screen.getByRole("combobox", { name: "Add contact" });
    await user.click(picker);
    await user.type(picker, "Nora Nobody");
    await user.click(
      screen.getByRole("option", {
        name: 'Add "Nora Nobody" as a new contact',
      }),
    );

    // The dialog holds focus, so Enter belongs to it and not the form behind.
    expect(screen.getByLabelText("First name")).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    const posted = (apiMocks.post.mock.mock.calls as unknown[][]).map(
      (call) => call[0],
    );
    expect(posted).toEqual(["/contacts"]);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does not save the pitch while the contact dialog is open", async () => {
    const user = userEvent.setup();
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.click(screen.getByRole("combobox", { name: "Add contact" }));
    await user.click(screen.getByRole("option", { name: "Add a new contact" }));

    const form = screen
      .getByRole("button", { name: /Add Pitch/i })
      .closest("form");
    if (!form) throw new Error("the create page rendered no form");
    fireEvent.submit(form);

    expect(apiMocks.post.mock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers a viewer no way to create a contact from the form", async () => {
    const user = userEvent.setup();
    mockUser = { role: "viewer" };
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.click(screen.getByRole("combobox", { name: "Add contact" }));
    expect(
      screen.queryByRole("option", { name: /Add a new contact/ }),
    ).not.toBeInTheDocument();
  });

  it("cancelling the contact dialog attaches nobody", async () => {
    const user = userEvent.setup();
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.click(screen.getByRole("combobox", { name: "Add contact" }));
    await user.click(screen.getByRole("option", { name: "Add a new contact" }));
    // Scoped to the dialog: the pitch form has a Cancel button of its own.
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Cancel/i,
      }),
    );

    expect(apiMocks.post.mock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("contact-chip")).not.toBeInTheDocument();
    expect(screen.getByText("No contacts")).toBeInTheDocument();
  });

  it("explains a failed contact load instead of showing an empty picker", async () => {
    apiMocks.get.mockImplementation((url: string) => {
      if (url === "/contacts")
        return Promise.reject(
          Object.assign(new Error("Request failed"), {
            response: { status: 500, data: { detail: "contacts unavailable" } },
          }),
        );
      return Promise.resolve({ data: [] });
    });
    render(<PitchCreatePage />);

    await waitFor(() => {
      expect(screen.getByText("contacts unavailable")).toBeInTheDocument();
    });
  });

  it("creates an organisation inline, selects it, and keeps what was already typed", async () => {
    const user = userEvent.setup();
    apiMocks.get.mockImplementation((url: string) => {
      if (url === "/organisations")
        return Promise.resolve({
          data: [{ id: "org-1", name: "Rozetta Institute" }],
        });
      return Promise.resolve({ data: [] });
    });
    apiMocks.post.mockResolvedValue({
      data: { id: "org-2", name: "Rozetta Institute (NSW)" },
    });
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.type(screen.getByLabelText(/Title/), "Soil Sensors");

    const picker = screen.getByRole("combobox", { name: /Organisation/ });
    await user.click(picker);
    await user.type(picker, "Rozetta Institute (NSW)");
    // The create row is offered even though an existing org matches the text.
    await user.click(
      screen.getByRole("option", {
        name: 'Add "Rozetta Institute (NSW)" as a new organisation',
      }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /^Add organisation$/i }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    // The new organisation is selected and nothing already typed was lost.
    expect(screen.getByRole("combobox", { name: /Organisation/ })).toHaveValue(
      "Rozetta Institute (NSW)",
    );
    expect(screen.getByLabelText(/Title/)).toHaveValue("Soil Sensors");

    // And it is what gets saved.
    await user.click(screen.getByRole("button", { name: /Add Pitch/i }));
    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/pitches",
      expect.objectContaining({ organisation_id: "org-2" }),
    );
  });

  it("Enter in the organisation dialog commits the organisation, not the pitch", async () => {
    const user = userEvent.setup();
    apiMocks.get.mockResolvedValue({ data: [] });
    apiMocks.post.mockResolvedValue({ data: { id: "org-9", name: "Acme" } });
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));
    await user.type(screen.getByLabelText(/Title/), "Soil Sensors");

    const picker = screen.getByRole("combobox", { name: /Organisation/ });
    await user.click(picker);
    await user.type(picker, "Acme");
    await user.click(
      screen.getByRole("option", { name: 'Add "Acme" as a new organisation' }),
    );

    // The dialog holds focus, so Enter belongs to it and not the form behind.
    expect(screen.getByLabelText(/Name/)).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    const posted = (apiMocks.post.mock.mock.calls as unknown[][]).map(
      (call) => call[0],
    );
    expect(posted).toEqual(["/organisations"]);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does not save the pitch while the organisation dialog is open", async () => {
    const user = userEvent.setup();
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.click(screen.getByRole("combobox", { name: /Organisation/ }));
    await user.click(
      screen.getByRole("option", { name: "Add a new organisation" }),
    );

    // A submit that arrives from anywhere while the dialog is up is ignored:
    // the dialog is a decision in progress, not a pitch to save.
    const form = screen
      .getByRole("button", { name: /Add Pitch/i })
      .closest("form");
    if (!form) throw new Error("the create page rendered no form");
    fireEvent.submit(form);

    expect(apiMocks.post.mock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers a viewer no way to create an organisation from the form", async () => {
    const user = userEvent.setup();
    mockUser = { role: "viewer" };
    render(<PitchCreatePage />);
    await waitFor(() => screen.getByText("New Pitch"));

    await user.click(screen.getByRole("combobox", { name: /Organisation/ }));
    expect(
      screen.queryByRole("option", { name: /Add a new organisation/ }),
    ).not.toBeInTheDocument();
  });

  it("explains a failed organisation load instead of showing an empty picker", async () => {
    apiMocks.get.mockImplementation((url: string) => {
      if (url === "/organisations")
        return Promise.reject(
          Object.assign(new Error("Request failed"), {
            response: { status: 500, data: { detail: "boom" } },
          }),
        );
      return Promise.resolve({ data: [] });
    });
    render(<PitchCreatePage />);

    await waitFor(() => {
      expect(screen.getByText("boom")).toBeInTheDocument();
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
