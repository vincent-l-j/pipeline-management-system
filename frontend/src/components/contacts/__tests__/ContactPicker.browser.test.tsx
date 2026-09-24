/**
 * The contact picker under a real finger.
 *
 * It is the combobox wrapped in a chip list, so the touch hazards it can suffer
 * are the combobox's — see Combobox.browser.test.tsx. What is worth asserting
 * separately is the wrapper's own moving part: the picker keeps its search box
 * pinned at value="", so a tapped selection has to land as an appended chip and
 * leave the box empty and ready for the next one.
 */

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

async function tapOption(name: string) {
  const id = page.getByRole("option", { name }).element().id;
  await commands.tap(`#${id}`);
}

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(() => {
  cleanup();
});

describe("ContactPicker under touch", () => {
  it("adds the contact that was tapped", async () => {
    const { onChange } = setup();
    await commands.tap("#picker");

    await tapOption("Ada Adams");

    expect(onChange).toHaveBeenCalledWith(["c2"]);
  });

  it("appends to an existing selection rather than replacing it", async () => {
    const { onChange } = setup({ value: ["c1"] });
    await commands.tap("#picker");

    await tapOption("Mid Middleton");

    expect(onChange).toHaveBeenCalledWith(["c1", "c3"]);
  });

  it("leaves focus on the search box so the keyboard survives a pick", async () => {
    setup();
    await commands.tap("#picker");

    await tapOption("Zoe Zimmer (zoe@example.com)");

    expect(document.activeElement?.id).toBe("picker");
  });
});
