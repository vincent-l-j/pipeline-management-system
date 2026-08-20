import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactQuickCreateModal from "../ContactQuickCreateModal";
import { createApiMocks } from "../../../test/mocks/api";

vi.mock("../../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

function setup(initialQuery = "", organisationIds: string[] = []) {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(
    <ContactQuickCreateModal
      initialQuery={initialQuery}
      organisationIds={organisationIds}
      onCreated={onCreated}
      onCancel={onCancel}
    />,
  );
  return { onCreated, onCancel };
}

describe("ContactQuickCreateModal", () => {
  it("is a labelled modal dialog", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Add contact");
  });

  it("takes focus when it opens, so Enter cannot reach the form behind it", () => {
    setup("Jane Doe");
    expect(screen.getByLabelText("First name")).toHaveFocus();
  });

  it("creates the contact when Enter is pressed in a field", async () => {
    const user = userEvent.setup();
    const created = {
      id: "c9",
      first_name: "Jane",
      last_name: "Doe",
      email: null,
      organisation_ids: [],
    };
    apiMocks.post.mockResolvedValue({ data: created });
    const { onCreated } = setup("Jane Doe");

    await user.keyboard("{Enter}");

    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/contacts",
      expect.objectContaining({ first_name: "Jane", last_name: "Doe" }),
    );
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(created);
    });
  });

  it("seeds the name from what the user typed into the picker", () => {
    setup("Jane Doe");
    expect(screen.getByLabelText("First name")).toHaveValue("Jane");
    expect(screen.getByLabelText("Last name")).toHaveValue("Doe");
  });

  it("seeds the email when the typed text is an address", () => {
    setup("jane@example.com");
    expect(screen.getByLabelText("Email")).toHaveValue("jane@example.com");
    expect(screen.getByLabelText("First name")).toHaveValue("");
  });

  it("offers only the fields that identify a person in a picker", () => {
    setup();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    // Phone, LinkedIn and notes belong on the Contacts page, not here.
    expect(screen.queryByLabelText(/Phone/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/LinkedIn/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Notes/)).not.toBeInTheDocument();
  });

  it("POSTs the contact with the affiliations it was opened for", async () => {
    const user = userEvent.setup();
    const created = {
      id: "c9",
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      organisation_ids: ["o1"],
    };
    apiMocks.post.mockResolvedValue({ data: created });
    const { onCreated } = setup("Jane Doe", ["o1"]);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.click(screen.getByRole("button", { name: /Add contact/i }));

    expect(apiMocks.post.mock).toHaveBeenCalledWith("/contacts", {
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      organisation_ids: ["o1"],
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(created);
    });
  });

  it("sends null rather than empty strings for the parts left blank", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({
      data: {
        id: "c9",
        first_name: "Mononym",
        last_name: null,
        email: null,
        organisation_ids: [],
      },
    });
    setup("Mononym");

    await user.click(screen.getByRole("button", { name: /Add contact/i }));

    expect(apiMocks.post.mock).toHaveBeenCalledWith("/contacts", {
      first_name: "Mononym",
      last_name: null,
      email: null,
      organisation_ids: [],
    });
  });

  it("refuses a contact with nothing recorded at all", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /Add contact/i }));

    expect(apiMocks.post.mock).not.toHaveBeenCalled();
    expect(screen.getByText(/name or email is required/i)).toBeInTheDocument();
  });

  it("accepts a nameless contact when an affiliation identifies them", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({
      data: {
        id: "c9",
        first_name: null,
        last_name: null,
        email: null,
        organisation_ids: ["o1"],
      },
    });
    setup("", ["o1"]);

    await user.click(screen.getByRole("button", { name: /Add contact/i }));

    expect(apiMocks.post.mock).toHaveBeenCalledWith("/contacts", {
      first_name: null,
      last_name: null,
      email: null,
      organisation_ids: ["o1"],
    });
  });

  it("shows a rejected save as a message and creates nothing", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockRejectedValue({
      response: {
        status: 422,
        data: { detail: [{ msg: "value is not a valid email address" }] },
      },
    });
    const { onCreated } = setup("Doomed Person");

    await user.click(screen.getByRole("button", { name: /Add contact/i }));

    await waitFor(() => {
      expect(
        screen.getByText("value is not a valid email address"),
      ).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("cancels on the Cancel button, on Escape and on a click outside", async () => {
    const user = userEvent.setup();

    const { onCancel } = setup();
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(2);

    await user.click(screen.getByTestId("contact-quick-create-overlay"));
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(apiMocks.post.mock).not.toHaveBeenCalled();
  });

  it("does not cancel when the click is inside the dialog", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();

    await user.click(screen.getByLabelText("First name"));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
