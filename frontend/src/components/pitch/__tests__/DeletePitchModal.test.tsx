import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeletePitchModal from "../DeletePitchModal";

function setup(
  overrides: Partial<Parameters<typeof DeletePitchModal>[0]> = {},
) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <DeletePitchModal
      pitchTitle="Green Hydrogen Initiative"
      meetingCount={0}
      assessmentCount={0}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onCancel, onConfirm };
}

function confirmButton() {
  return screen.getByRole("button", { name: "Delete pitch" });
}

describe("DeletePitchModal", () => {
  it("names the pitch being deleted", () => {
    setup();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Green Hydrogen Initiative/).length,
    ).toBeGreaterThan(0);
  });

  it("reports how many assessments and meetings will be destroyed", () => {
    setup({ assessmentCount: 3, meetingCount: 2 });
    expect(screen.getByText(/3 assessments/)).toBeInTheDocument();
    expect(screen.getByText(/2 meetings/)).toBeInTheDocument();
  });

  it("singularises the impact counts", () => {
    setup({ assessmentCount: 1, meetingCount: 1 });
    expect(screen.getByText(/1 assessment\b/)).toBeInTheDocument();
    expect(screen.getByText(/1 meeting\b/)).toBeInTheDocument();
  });

  it("warns that the action cannot be undone", () => {
    setup();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("disables confirm until the title is typed", () => {
    setup();
    expect(confirmButton()).toBeDisabled();
  });

  it("keeps confirm disabled for a partial title", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.type(screen.getByLabelText(/type/i), "Green Hydrogen");
    expect(confirmButton()).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps confirm disabled for a wrong title", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/type/i), "Some Other Pitch");
    expect(confirmButton()).toBeDisabled();
  });

  it("enables confirm and calls onConfirm once the exact title is typed", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.type(
      screen.getByLabelText(/type/i),
      "Green Hydrogen Initiative",
    );
    expect(confirmButton()).toBeEnabled();
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when Escape is pressed", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on an outside click", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    await user.click(screen.getByTestId("delete-pitch-overlay"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows an error message when one is supplied", () => {
    setup({ error: "Requires role: admin" });
    expect(screen.getByText("Requires role: admin")).toBeInTheDocument();
  });

  it("disables both controls while the delete is in flight", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = setup({ deleting: true });
    await user.type(
      screen.getByLabelText(/type/i),
      "Green Hydrogen Initiative",
    );

    const confirm = screen.getByRole("button", { name: "Deleting..." });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
