/**
 * The organisation picker under a real finger.
 *
 * The twin of ContactPicker.browser.test.tsx, and kept separate rather than
 * shared: the two pickers are deliberately the same shape, so the value of
 * testing both is catching the day one of them drifts.
 */

import { commands, page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import OrganisationPicker from "../OrganisationPicker";
import type { Organisation } from "../../../types";

function org(id: string, name: string): Organisation {
  return {
    id,
    name,
    org_type: null,
    sector: null,
    state_territory: null,
    website: null,
    abn: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const ORGANISATIONS = [
  org("o1", "Zenith Labs"),
  org("o2", "Acme Research"),
  org("o3", "Rozetta Institute"),
];

function setup(
  props: Partial<React.ComponentProps<typeof OrganisationPicker>> = {},
) {
  const onChange = vi.fn();
  render(
    <OrganisationPicker
      id="orgs"
      organisations={ORGANISATIONS}
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

describe("OrganisationPicker under touch", () => {
  it("adds the organisation that was tapped", async () => {
    const { onChange } = setup();
    await commands.tap("#orgs");

    await tapOption("Acme Research");

    expect(onChange).toHaveBeenCalledWith(["o2"]);
  });

  it("appends to an existing selection rather than replacing it", async () => {
    const { onChange } = setup({ value: ["o1"] });
    await commands.tap("#orgs");

    await tapOption("Rozetta Institute");

    expect(onChange).toHaveBeenCalledWith(["o1", "o3"]);
  });

  it("leaves focus on the search box so the keyboard survives a pick", async () => {
    setup();
    await commands.tap("#orgs");

    await tapOption("Zenith Labs");

    expect(document.activeElement?.id).toBe("orgs");
  });
});
