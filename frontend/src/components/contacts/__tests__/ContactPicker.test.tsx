import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactPicker from "../ContactPicker";
import type { Contact } from "../../../types";

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
  props: Partial<React.ComponentProps<typeof ContactPicker>> = {},
) {
  const onChange = vi.fn();
  render(
    <ContactPicker
      id="picker"
      contacts={CONTACTS}
      value={[]}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

function searchBox(): HTMLElement {
  return screen.getByRole("combobox", { name: "Add contact" });
}

describe("ContactPicker", () => {
  it("lists the selected contacts by name, alphabetically", () => {
    setup({ value: ["c1", "c2"] });
    const chips = screen.getAllByTestId("contact-chip");
    expect(chips.map((c) => c.textContent)).toEqual([
      expect.stringContaining("Ada Adams"),
      expect.stringContaining("Zoe Zimmer"),
    ]);
  });

  it("names a contact with neither name part rather than showing a blank chip", () => {
    setup({
      contacts: [contact("c9", null, null, "anon@example.com")],
      value: ["c9"],
    });
    expect(screen.getByTestId("contact-chip")).toHaveTextContent(
      "Unnamed contact",
    );
  });

  it("offers the email as a tie-breaker in the options", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(searchBox());
    expect(
      screen.getByRole("option", { name: "Zoe Zimmer (zoe@example.com)" }),
    ).toBeInTheDocument();
    // Nothing to disambiguate with, so the name stands alone.
    expect(
      screen.getByRole("option", { name: "Ada Adams" }),
    ).toBeInTheDocument();
  });

  it("offers only the contacts not already picked", async () => {
    const user = userEvent.setup();
    setup({ value: ["c2"] });
    await user.click(searchBox());
    expect(
      screen.getByRole("option", { name: "Mid Middleton" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Ada Adams" }),
    ).not.toBeInTheDocument();
  });

  it("appends the chosen contact rather than replacing the selection", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: ["c1"] });
    await user.click(searchBox());
    await user.click(screen.getByRole("option", { name: "Mid Middleton" }));
    expect(onChange).toHaveBeenCalledWith(["c1", "c3"]);
  });

  it("clears its search box after a pick, ready for the next one", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(searchBox());
    await user.type(searchBox(), "mid");
    await user.click(screen.getByRole("option", { name: "Mid Middleton" }));
    expect(searchBox()).toHaveValue("");
  });

  it("removes one contact without disturbing the others", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: ["c1", "c2"] });
    await user.click(screen.getByRole("button", { name: "Remove Zoe Zimmer" }));
    expect(onChange).toHaveBeenCalledWith(["c2"]);
  });

  it("says so when nobody is picked", () => {
    setup();
    expect(screen.getByText("No contacts")).toBeInTheDocument();
    expect(screen.queryByTestId("contact-chip")).not.toBeInTheDocument();
  });

  it("ignores an id that matches nobody on file", () => {
    setup({ value: ["gone"] });
    expect(screen.getByText("No contacts")).toBeInTheDocument();
  });

  it("offers a create row when the caller can create contacts", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    setup({ onCreate });
    await user.click(searchBox());
    await user.type(searchBox(), "Nora Nobody");
    await user.click(
      screen.getByRole("option", {
        name: 'Add "Nora Nobody" as a new contact',
      }),
    );
    expect(onCreate).toHaveBeenCalledWith("Nora Nobody");
  });

  it("has no create row without an onCreate handler", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(searchBox());
    await user.type(searchBox(), "Nora Nobody");
    expect(
      screen.queryByRole("option", { name: /^Add / }),
    ).not.toBeInTheDocument();
  });

  it("shows the names read-only when disabled", () => {
    setup({ value: ["c1"], disabled: true });
    expect(screen.getByText("Zoe Zimmer")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Zoe Zimmer" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
