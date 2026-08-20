import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrganisationQuickCreateModal from "../OrganisationQuickCreateModal";
import { createApiMocks } from "../../../test/mocks/api";

vi.mock("../../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMocks = createApiMocks();

function setup(initialName = "") {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(
    <OrganisationQuickCreateModal
      initialName={initialName}
      onCreated={onCreated}
      onCancel={onCancel}
    />,
  );
  return { onCreated, onCancel };
}

describe("OrganisationQuickCreateModal", () => {
  it("is a labelled modal dialog", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Add organisation");
  });

  it("takes focus when it opens, so Enter cannot reach the form behind it", () => {
    setup("Rozetta Institute");
    expect(screen.getByLabelText(/Name/)).toHaveFocus();
  });

  it("creates the organisation when Enter is pressed in a field", async () => {
    const user = userEvent.setup();
    const created = { id: "org-9", name: "Rozetta Institute" };
    apiMocks.post.mockResolvedValue({ data: created });
    const { onCreated } = setup("Rozetta Institute");

    await user.keyboard("{Enter}");

    expect(apiMocks.post.mock).toHaveBeenCalledWith(
      "/organisations",
      expect.objectContaining({ name: "Rozetta Institute" }),
    );
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(created);
    });
  });

  it("seeds the name with what the user already typed into the picker", () => {
    setup("Rozetta Institute (NSW)");
    expect(screen.getByLabelText(/Name/)).toHaveValue(
      "Rozetta Institute (NSW)",
    );
  });

  it("offers only the fields that disambiguate an organisation in a picker", () => {
    setup();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Type/)).toBeInTheDocument();
    expect(screen.getByLabelText(/State/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Website/)).toBeInTheDocument();
    // Sector, ABN and notes belong on the Organisations page, not here.
    expect(screen.queryByLabelText(/Sector/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ABN/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Notes/)).not.toBeInTheDocument();
  });

  it("POSTs the organisation and hands the created record back", async () => {
    const user = userEvent.setup();
    const created = { id: "org-9", name: "Brand New Org" };
    apiMocks.post.mockResolvedValue({ data: created });
    const { onCreated } = setup("Brand New Org");

    await user.selectOptions(screen.getByLabelText(/Type/), "university");
    await user.type(screen.getByLabelText(/State/), "NSW");
    await user.click(screen.getByRole("button", { name: /Add organisation/i }));

    expect(apiMocks.post.mock).toHaveBeenCalledWith("/organisations", {
      name: "Brand New Org",
      org_type: "university",
      state_territory: "NSW",
      website: null,
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(created);
    });
  });

  it("sends null rather than empty strings for the fields left blank", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockResolvedValue({
      data: { id: "org-9", name: "Bare Org" },
    });
    setup("Bare Org");

    await user.click(screen.getByRole("button", { name: /Add organisation/i }));

    expect(apiMocks.post.mock).toHaveBeenCalledWith("/organisations", {
      name: "Bare Org",
      org_type: null,
      state_territory: null,
      website: null,
    });
  });

  it("refuses a blank name without calling the API", async () => {
    const user = userEvent.setup();
    setup("   ");

    await user.click(screen.getByRole("button", { name: /Add organisation/i }));

    expect(apiMocks.post.mock).not.toHaveBeenCalled();
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it("shows a rejected save as a message and creates nothing", async () => {
    const user = userEvent.setup();
    apiMocks.post.mockRejectedValue({
      response: { status: 422, data: { detail: [{ msg: "name too long" }] } },
    });
    const { onCreated } = setup("Doomed Org");

    await user.click(screen.getByRole("button", { name: /Add organisation/i }));

    await waitFor(() => {
      expect(screen.getByText("name too long")).toBeInTheDocument();
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

    await user.click(screen.getByTestId("organisation-quick-create-overlay"));
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(apiMocks.post.mock).not.toHaveBeenCalled();
  });

  it("does not cancel when the click is inside the dialog", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();

    await user.click(screen.getByLabelText(/Name/));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
