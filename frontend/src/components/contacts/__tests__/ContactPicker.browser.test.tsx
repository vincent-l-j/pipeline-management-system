import { useState } from "react";
import { commands, page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import ContactPicker from "../ContactPicker";
import type { Contact } from "../../../types";

function contact(
  id: string,
  first_name: string,
  last_name: string,
  email: string | null = null,
): Contact {
  return { id, first_name, last_name, email, organisation_ids: [] };
}

const CONTACTS = [
  contact("c1", "Zoe", "Zimmer", "zoe@example.com"),
  contact("c2", "Ada", "Adams"),
  contact("c3", "Mid", "Middleton"),
];

/** Stateful, because the behaviour under test is what the second tap sees. */
function Harness() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <ContactPicker
      id="picker"
      contacts={CONTACTS}
      value={value}
      onChange={setValue}
    />
  );
}

async function tapOption(name: string) {
  await commands.tap(`#${page.getByRole("option", { name }).element().id}`);
}

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(() => {
  cleanup();
});

// The picker pins its search box at value="" so picking appends rather than
// replaces. jsdom already proves that for one click; what needs a real finger is
// that the box comes back empty and usable for a second tap.
describe("ContactPicker under touch", () => {
  it("picks twice in a row without the first pick being re-offered", async () => {
    render(<Harness />);

    await commands.tap("#picker");
    await tapOption("Ada Adams");
    await expect
      .element(page.getByTestId("contact-chip"))
      .toHaveTextContent("Ada Adams");

    await commands.tap("#picker");
    await expect
      .element(page.getByRole("option", { name: "Ada Adams" }))
      .not.toBeInTheDocument();
    await tapOption("Mid Middleton");

    const chips = page.getByTestId("contact-chip").elements();
    expect(chips.map((chip) => chip.textContent.replace("×", ""))).toEqual([
      "Ada Adams",
      "Mid Middleton",
    ]);
  });

  // The keyboard would otherwise drop between picks.
  it("leaves focus on the search box after a tapped pick", async () => {
    render(<Harness />);
    await commands.tap("#picker");

    await tapOption("Zoe Zimmer (zoe@example.com)");

    await expect.poll(() => document.activeElement?.id).toBe("picker");
  });
});
