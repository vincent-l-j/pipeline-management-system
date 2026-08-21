import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddPitchContactsModal from "../AddPitchContactsModal";
import { createApiMocks } from "../../../test/mocks/api";
import type { Contact } from "../../../types";

vi.mock("../../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

function contact(
  id: string,
  first_name: string | null,
  last_name: string | null,
  email: string | null = null,
): Contact {
  return { id, first_name, last_name, email, organisation_ids: [] };
}

const CONTACTS = [
  contact("c1", "Zoe", "Zimmer", "zoe@example.com"),
  contact("c2", "Ada", "Adams"),
  contact("c3", "Mid", "Middleton"),
];

function setup(
  props: Partial<React.ComponentProps<typeof AddPitchContactsModal>> = {},
) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  const onContactCreated = vi.fn();
  render(
    <AddPitchContactsModal
      pitchId="42"
      contacts={CONTACTS}
      attachedIds={[]}
      onSaved={onSaved}
      onCancel={onCancel}
      onContactCreated={onContactCreated}
      {...props}
    />,
  );
  return { onSaved, onCancel, onContactCreated };
}

function searchBox(): HTMLElement {
  return screen.getByRole("combobox", { name: "Add contact" });
}

function addButton(): HTMLElement {
  return screen.getByRole("button", { name: "Add to pitch" });
}

describe("AddPitchContactsModal", () => {
  it("is a labelled modal dialog", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Add contacts");
  });

  it("takes focus on its picker, so it can be used without reaching for the mouse", () => {
    setup();
    expect(searchBox()).toHaveFocus();
  });

  it("starts with nothing picked, since it only ever adds", () => {
    setup({ attachedIds: ["c1"] });
    expect(screen.queryByTestId("contact-chip")).not.toBeInTheDocument();
  });

  it("does not offer the people already on the pitch", async () => {
    const user = userEvent.setup();
    setup({ attachedIds: ["c2"] });
    await user.click(searchBox());

    expect(
      screen.getByRole("option", { name: "Mid Middleton" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Ada Adams" }),
    ).not.toBeInTheDocument();
  });

  it("saves the people already on the pitch alongside the newly picked ones", async () => {
    const user = userEvent.setup();
    apiMocks.patch.mockResolvedValue({
      data: { contact_ids: ["c1", "c2", "c3"] },
    });
    const { onSaved } = setup({ attachedIds: ["c1"] });

    await user.click(searchBox());
    await user.click(screen.getByRole("option", { name: "Ada Adams" }));
    await user.click(searchBox());
    await user.click(screen.getByRole("option", { name: "Mid Middleton" }));
    await user.click(addButton());

    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/pitches/42", {
      contact_ids: ["c1", "c2", "c3"],
    });
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(["c1", "c2", "c3"]);
    });
  });

  it("reports the set the server confirmed rather than the one it was sent", async () => {
    const user = userEvent.setup();
    // The server deduplicates, so its answer is the one worth believing.
    apiMocks.patch.mockResolvedValue({ data: { contact_ids: ["c1", "c2"] } });
    const { onSaved } = setup({ attachedIds: ["c1", "c1"] });

    await user.click(searchBox());
    await user.click(screen.getByRole("option", { name: "Ada Adams" }));
    await user.click(addButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(["c1", "c2"]);
    });
  });

  it("cannot be saved with nobody picked, so it never sends an empty change", () => {
    setup({ attachedIds: ["c1"] });
    expect(addButton()).toBeDisabled();
    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
  });

  it("removes a pick before saving without touching the pitch", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(searchBox());
    await user.click(screen.getByRole("option", { name: "Ada Adams" }));
    await user.click(screen.getByRole("button", { name: "Remove Ada Adams" }));

    expect(screen.queryByTestId("contact-chip")).not.toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and says why when the save fails", async () => {
    const user = userEvent.setup();
    apiMocks.patch.mockRejectedValue({
      response: { status: 422, data: { detail: "Unknown contact: c2" } },
    });
    const { onSaved, onCancel } = setup();

    await user.click(searchBox());
    await user.click(screen.getByRole("option", { name: "Ada Adams" }));
    await user.click(addButton());

    expect(await screen.findByText("Unknown contact: c2")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByTestId("contact-chip")).toHaveTextContent("Ada Adams");
  });

  it("creates a contact who is not on file and picks them straight away", async () => {
    const user = userEvent.setup();
    const created = contact("c9", "Nora", "Nobody");
    apiMocks.post.mockResolvedValue({ data: created });
    const { onContactCreated } = setup();

    await user.click(searchBox());
    await user.type(searchBox(), "Nora Nobody");
    await user.click(
      screen.getByRole("option", {
        name: 'Add "Nora Nobody" as a new contact',
      }),
    );

    // Seeded from what was typed, so the name is not retyped.
    expect(screen.getByLabelText("First name")).toHaveValue("Nora");
    expect(screen.getByLabelText("Last name")).toHaveValue("Nobody");

    await user.click(screen.getByRole("button", { name: "Add contact" }));

    await waitFor(() => {
      expect(screen.getByTestId("contact-chip")).toHaveTextContent(
        "Nora Nobody",
      );
    });
    expect(onContactCreated).toHaveBeenCalledWith(created);
    expect(
      screen.queryByTestId("contact-quick-create-overlay"),
    ).not.toBeInTheDocument();
  });

  it("lists a created contact once, even when the caller folds them in too", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({ data: contact("c9", "Nora", "Nobody") });

    // A caller that keeps its own directory hands the new contact straight back
    // as a prop, so the modal sees them from both sides.
    function Harness(): React.JSX.Element {
      const [directory, setDirectory] = useState(CONTACTS);
      return (
        <AddPitchContactsModal
          pitchId="42"
          contacts={directory}
          attachedIds={[]}
          onContactCreated={(added) => {
            setDirectory((prev) => [...prev, added]);
          }}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />
      );
    }
    render(<Harness />);

    await user.click(searchBox());
    await user.type(searchBox(), "Nora");
    await user.click(
      screen.getByRole("option", { name: 'Add "Nora" as a new contact' }),
    );
    await user.click(screen.getByRole("button", { name: "Add contact" }));

    await waitFor(() => {
      expect(screen.getAllByTestId("contact-chip")).toHaveLength(1);
    });
  });

  it("saves a freshly created contact onto the pitch", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({ data: contact("c9", "Nora", "Nobody") });
    apiMocks.patch.mockResolvedValue({ data: { contact_ids: ["c1", "c9"] } });
    const { onSaved } = setup({ attachedIds: ["c1"] });

    await user.click(searchBox());
    await user.type(searchBox(), "Nora");
    await user.click(
      screen.getByRole("option", { name: 'Add "Nora" as a new contact' }),
    );
    await user.click(screen.getByRole("button", { name: "Add contact" }));
    await waitFor(() => {
      expect(screen.getByTestId("contact-chip")).toBeInTheDocument();
    });
    await user.click(addButton());

    expect(apiMocks.patch.mock).toHaveBeenCalledWith("/pitches/42", {
      contact_ids: ["c1", "c9"],
    });
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(["c1", "c9"]);
    });
  });

  it("cancels on Escape", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    // Twice: the picker takes focus on open, and Combobox swallows the first
    // Escape to close its own list before one reaches the dialog.
    await user.keyboard("{Escape}{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("cancels on a click outside the panel", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    await user.click(screen.getByTestId("add-pitch-contacts-overlay"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("leaves the pitch alone when cancelled", async () => {
    const user = userEvent.setup();
    const { onCancel, onSaved } = setup();
    await user.click(searchBox());
    await user.click(screen.getByRole("option", { name: "Ada Adams" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(apiMocks.patch.mock).not.toHaveBeenCalled();
  });

  it("Escape over the quick-create dialog closes only that dialog", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();

    await user.click(searchBox());
    await user.type(searchBox(), "Nora");
    await user.click(
      screen.getByRole("option", { name: 'Add "Nora" as a new contact' }),
    );
    await user.keyboard("{Escape}");

    expect(
      screen.queryByTestId("contact-quick-create-overlay"),
    ).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(searchBox()).toBeInTheDocument();
  });

  it("stays open when the quick-create dialog is clicked", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();

    await user.click(searchBox());
    await user.type(searchBox(), "Nora");
    await user.click(
      screen.getByRole("option", { name: 'Add "Nora" as a new contact' }),
    );
    await user.click(
      within(screen.getByTestId("contact-quick-create-overlay")).getByRole(
        "heading",
        { name: "Add contact" },
      ),
    );

    expect(onCancel).not.toHaveBeenCalled();
  });
});
