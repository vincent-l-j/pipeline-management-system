import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PitchFormFields from "../PitchFormFields";
import { EMPTY_PITCH_FORM, PitchFormValues } from "../pitchForm";
import { Contact, Organisation, User } from "../../../types";

const ORGANISATIONS = [
  { id: "org-1", name: "Acme Research" },
  { id: "org-2", name: "Beta Institute" },
] as Organisation[];

const CONTACTS: Contact[] = [
  {
    id: "c1",
    first_name: "Ada",
    last_name: "Adams",
    email: "ada@example.com",
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
      contacts={CONTACTS}
      users={USERS}
      {...props}
    />,
  );
  return { onChange };
}

describe("PitchFormFields", () => {
  it.each([
    "Title",
    "Short Description",
    "Submission Date",
    "Source",
    "Funding Pathway",
    "Organisation",
    "Add contact",
    "Rozetta Lead",
    "Masterplan Alignment",
    "Mark as confidential",
  ])("labels %s so it is reachable without a display value", (label) => {
    setup();
    expect(screen.getByLabelText(new RegExp(label))).toBeInTheDocument();
  });

  it("renders no form element and no submit button, so the page owns submission", () => {
    const { container } = render(
      <PitchFormFields
        values={EMPTY_PITCH_FORM}
        onChange={vi.fn()}
        organisations={ORGANISATIONS}
        contacts={CONTACTS}
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

  /*
   * These assert the whole option list, not the presence of each value: a
   * presence check passes just as happily when an extra value has crept in, so
   * it cannot say "exactly". The expected lists are spelled out rather than
   * derived from SOURCE_LABELS/FUNDING_LABELS, so that dropping a value from
   * the label map fails here instead of quietly changing both sides at once.
   */
  it.each([
    [
      "Source",
      [
        "Select source...",
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
      ],
    ],
    [
      "Funding Pathway",
      [
        "Select funding pathway...",
        "CRC Bid",
        "RDTI",
        "Philanthropic",
        "Government Grant",
        "Private",
        "Other",
        "No Funding Identified",
        "Internal Funding",
      ],
    ],
  ])(
    "offers exactly the %s values the backend can return",
    (label, expected) => {
      setup();
      const select = screen.getByLabelText(new RegExp(label));
      const options = within(select).getAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual(expected);
    },
  );

  it("offers exactly the current domains as pills, in order", () => {
    // The pills are the only buttons this component renders. An exact list also
    // covers the retired vocabulary — "AI Energy Transition", "Climate",
    // "Digital", "Forestry", "Agri" and "Education" cannot reappear unnoticed.
    setup();
    expect(
      screen.getAllByRole("button").map((pill) => pill.textContent),
    ).toEqual([
      "AI",
      "Energy Transition",
      "Digital Finance",
      "Critical Minerals",
      "Semiconductors",
      "Health",
      "Innovation system",
      "Other",
    ]);
  });

  it("lists the supplied users as lead options", () => {
    setup();
    expect(
      screen.getByRole("option", { name: "Ada Lovelace" }),
    ).toBeInTheDocument();
  });

  it("offers the supplied organisations through a searchable picker", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    // Name-scoped: the form also has three native selects, which RTL maps to
    // the combobox role too.
    const picker = screen.getByRole("combobox", { name: /Organisation/ });
    await user.click(picker);
    await user.type(picker, "acme");

    await user.click(screen.getByRole("option", { name: "Acme Research" }));
    expect(onChange).toHaveBeenCalledWith({ organisation_id: "org-1" });
  });

  it("shows the selected organisation's name", () => {
    setup({ organisation_id: "org-2" });
    expect(screen.getByRole("combobox", { name: /Organisation/ })).toHaveValue(
      "Beta Institute",
    );
  });

  it("offers no create-organisation row unless the page supplies a handler", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox", { name: /Organisation/ }));
    expect(
      screen.queryByRole("option", { name: /Add a new organisation/ }),
    ).not.toBeInTheDocument();
  });

  it("offers a create-organisation row when the page supplies a handler", async () => {
    const user = userEvent.setup();
    const onCreateOrganisation = vi.fn();
    render(
      <PitchFormFields
        values={EMPTY_PITCH_FORM}
        onChange={vi.fn()}
        organisations={ORGANISATIONS}
        contacts={CONTACTS}
        users={USERS}
        onCreateOrganisation={onCreateOrganisation}
      />,
    );
    const picker = screen.getByRole("combobox", { name: /Organisation/ });
    await user.click(picker);
    await user.type(picker, "Gamma");
    await user.click(
      screen.getByRole("option", {
        name: 'Add "Gamma" as a new organisation',
      }),
    );

    expect(onCreateOrganisation).toHaveBeenCalledWith("Gamma");
  });

  it("surfaces an organisation load failure under the picker", () => {
    render(
      <PitchFormFields
        values={EMPTY_PITCH_FORM}
        onChange={vi.fn()}
        organisations={[]}
        contacts={CONTACTS}
        users={USERS}
        organisationsError="Could not load organisations"
      />,
    );
    expect(
      screen.getByText("Could not load organisations"),
    ).toBeInTheDocument();
  });

  it("offers the supplied contacts through a searchable picker", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    const picker = screen.getByRole("combobox", { name: "Add contact" });
    await user.click(picker);
    await user.type(picker, "ada");
    await user.click(
      screen.getByRole("option", { name: "Ada Adams (ada@example.com)" }),
    );

    expect(onChange).toHaveBeenCalledWith({ contact_ids: ["c1"] });
  });

  it("keeps the contacts already on the pitch when another is added", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ contact_ids: ["c2"] });

    const picker = screen.getByRole("combobox", { name: "Add contact" });
    await user.click(picker);
    await user.click(screen.getByRole("option", { name: /Ada Adams/ }));

    expect(onChange).toHaveBeenCalledWith({ contact_ids: ["c2", "c1"] });
  });

  it("shows the pitch's contacts as chips", () => {
    setup({ contact_ids: ["c1", "c2"] });
    expect(
      screen.getAllByTestId("contact-chip").map((chip) => chip.textContent),
    ).toEqual([
      expect.stringContaining("Ada Adams"),
      expect.stringContaining("Bob Brown"),
    ]);
  });

  it("reports the remainder when a contact is removed", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ contact_ids: ["c1", "c2"] });
    await user.click(screen.getByRole("button", { name: "Remove Ada Adams" }));
    expect(onChange).toHaveBeenCalledWith({ contact_ids: ["c2"] });
  });

  it("offers no create-contact row unless the page supplies a handler", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox", { name: "Add contact" }));
    expect(
      screen.queryByRole("option", { name: /Add a new contact/ }),
    ).not.toBeInTheDocument();
  });

  it("surfaces a contact load failure under the picker", () => {
    render(
      <PitchFormFields
        values={EMPTY_PITCH_FORM}
        onChange={vi.fn()}
        organisations={ORGANISATIONS}
        contacts={[]}
        users={USERS}
        contactsError="Could not load contacts"
      />,
    );
    expect(screen.getByText("Could not load contacts")).toBeInTheDocument();
  });

  it("disables every control when disabled", () => {
    setup({ domain_tags: ["AI"] }, { disabled: true });
    expect(screen.getByLabelText(/Title/)).toBeDisabled();
    expect(screen.getByLabelText(/Submission Date/)).toBeDisabled();
    expect(screen.getByLabelText(/Source/)).toBeDisabled();
    expect(screen.getByLabelText(/Organisation/)).toBeDisabled();
    expect(screen.getByLabelText(/Mark as confidential/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Health" })).toBeDisabled();
    // The contact picker has no disabled state to show: its controls go.
    expect(
      screen.queryByRole("combobox", { name: "Add contact" }),
    ).not.toBeInTheDocument();
  });

  it("still shows the contacts on a disabled form", () => {
    setup({ contact_ids: ["c1"] }, { disabled: true });
    expect(screen.getByTestId("contact-chip")).toHaveTextContent("Ada Adams");
    expect(
      screen.queryByRole("button", { name: "Remove Ada Adams" }),
    ).not.toBeInTheDocument();
  });

  it("reports nothing when a disabled pill is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({}, { disabled: true });
    await user.click(screen.getByRole("button", { name: "Health" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
