import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PitchFormFields from "../PitchFormFields";
import { EMPTY_PITCH_FORM, PitchFormValues } from "../pitchForm";
import { Organisation, User } from "../../../types";

const ORGANISATIONS = [
  { id: "org-1", name: "Acme Research" },
  { id: "org-2", name: "Beta Institute" },
] as Organisation[];

const USERS = [
  { id: "user-1", display_name: "Ada Lovelace" },
  { id: "user-2", display_name: "Alan Turing" },
] as User[];

function setup(
  values: Partial<PitchFormValues> = {},
  props: { disabled?: boolean } = {},
) {
  const onChange = vi.fn();
  render(
    <PitchFormFields
      values={{ ...EMPTY_PITCH_FORM, ...values }}
      onChange={onChange}
      organisations={ORGANISATIONS}
      users={USERS}
      {...props}
    />,
  );
  return { onChange };
}

describe("PitchFormFields", () => {
  it("labels every field so it is reachable without a display value", () => {
    setup();
    for (const label of [
      /Title/,
      /Short Description/,
      /Submission Date/,
      /Source/,
      /Funding Pathway/,
      /Organisation/,
      /Rozetta Lead/,
      /Masterplan Alignment/,
      /Mark as confidential/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("renders no form element and no submit button, so the page owns submission", () => {
    const { container } = render(
      <PitchFormFields
        values={EMPTY_PITCH_FORM}
        onChange={vi.fn()}
        organisations={ORGANISATIONS}
        users={USERS}
      />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /save|add pitch|submit/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the submission date to both the create and edit pages", () => {
    setup({ submission_date: "2026-02-03" });
    expect(screen.getByLabelText(/Submission Date/)).toHaveValue("2026-02-03");
  });

  it("reports an edited submission date as a partial patch", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ submission_date: "2026-02-03" });
    await user.clear(screen.getByLabelText(/Submission Date/));
    expect(onChange).toHaveBeenCalledWith({ submission_date: "" });
  });

  it("offers no pipeline-stage control", () => {
    setup();
    expect(screen.queryByLabelText(/stage/i)).not.toBeInTheDocument();
  });

  it("reports a typed title as a partial patch of just that field", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.type(screen.getByLabelText(/Title/), "S");
    expect(onChange).toHaveBeenCalledWith({ title: "S" });
  });

  it("reports a chosen source and a toggled checkbox", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.selectOptions(screen.getByLabelText(/Source/), "riac");
    expect(onChange).toHaveBeenCalledWith({ source: "riac" });

    await user.click(screen.getByLabelText(/Mark as confidential/));
    expect(onChange).toHaveBeenCalledWith({ is_confidential: true });
  });

  it("adds a domain when an unselected pill is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ domain_tags: ["AI"] });
    await user.click(screen.getByRole("button", { name: "Health" }));
    expect(onChange).toHaveBeenCalledWith({ domain_tags: ["AI", "Health"] });
  });

  it("removes a domain when an already-selected pill is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ domain_tags: ["AI", "Health"] });
    await user.click(screen.getByRole("button", { name: "AI" }));
    expect(onChange).toHaveBeenCalledWith({ domain_tags: ["Health"] });
  });

  it("marks the domain pills that are currently selected", () => {
    setup({ domain_tags: ["AI"] });
    expect(screen.getByRole("button", { name: "AI" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Health" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("offers every source and funding pathway the backend can return", () => {
    setup();
    for (const source of [
      "Referral",
      "Website",
      "Event",
      "Cold Outreach",
      "Internal",
      "RIAC",
      "Foundry",
      "Board",
      "RIAC Student",
      "Rozetta Network",
    ]) {
      expect(screen.getByRole("option", { name: source })).toBeInTheDocument();
    }
    for (const pathway of [
      "CRC Bid",
      "RDTI",
      "Philanthropic",
      "Government Grant",
      "Private",
      "Other",
      "No Funding Identified",
      "Internal Funding",
    ]) {
      expect(screen.getByRole("option", { name: pathway })).toBeInTheDocument();
    }
  });

  it("offers exactly the current domains as pills", () => {
    setup();
    for (const domain of [
      "AI",
      "Energy Transition",
      "Digital Finance",
      "Critical Minerals",
      "Semiconductors",
      "Health",
      "Innovation system",
      "Other",
    ]) {
      expect(screen.getByRole("button", { name: domain })).toBeInTheDocument();
    }
  });

  it("no longer offers the retired domains", () => {
    setup();
    for (const retired of [
      "AI Energy Transition",
      "Climate",
      "Digital",
      "Forestry",
      "Agri",
      "Education",
    ]) {
      expect(
        screen.queryByRole("button", { name: retired }),
      ).not.toBeInTheDocument();
    }
  });

  it("lists the supplied organisations and users as options", () => {
    setup();
    expect(
      screen.getByRole("option", { name: "Acme Research" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Ada Lovelace" }),
    ).toBeInTheDocument();
  });

  it("disables every control when disabled", () => {
    setup({ domain_tags: ["AI"] }, { disabled: true });
    expect(screen.getByLabelText(/Title/)).toBeDisabled();
    expect(screen.getByLabelText(/Submission Date/)).toBeDisabled();
    expect(screen.getByLabelText(/Source/)).toBeDisabled();
    expect(screen.getByLabelText(/Organisation/)).toBeDisabled();
    expect(screen.getByLabelText(/Mark as confidential/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Health" })).toBeDisabled();
  });

  it("reports nothing when a disabled pill is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({}, { disabled: true });
    await user.click(screen.getByRole("button", { name: "Health" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
