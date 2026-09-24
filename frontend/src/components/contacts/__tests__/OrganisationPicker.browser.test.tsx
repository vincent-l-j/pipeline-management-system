import { useState } from "react";
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

/** Stateful, because the behaviour under test is what the second tap sees. */
function Harness() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <OrganisationPicker
      id="orgs"
      organisations={ORGANISATIONS}
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

// The twin of ContactPicker.browser.test.tsx, kept separate rather than shared:
// the two pickers are deliberately the same shape, so the value of covering both
// is catching the day one of them drifts.
describe("OrganisationPicker under touch", () => {
  it("picks twice in a row without the first pick being re-offered", async () => {
    render(<Harness />);

    await commands.tap("#orgs");
    await tapOption("Acme Research");
    await expect
      .element(page.getByTestId("organisation-chip"))
      .toHaveTextContent("Acme Research");

    await commands.tap("#orgs");
    await expect
      .element(page.getByRole("option", { name: "Acme Research" }))
      .not.toBeInTheDocument();
    await tapOption("Zenith Labs");

    const chips = page.getByTestId("organisation-chip").elements();
    expect(chips.map((chip) => chip.textContent.replace("×", ""))).toEqual([
      "Acme Research",
      "Zenith Labs",
    ]);
  });

  it("leaves focus on the search box after a tapped pick", async () => {
    render(<Harness />);
    await commands.tap("#orgs");

    await tapOption("Rozetta Institute");

    await expect.poll(() => document.activeElement?.id).toBe("orgs");
  });
});
