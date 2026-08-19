import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  org("o1", "Zeta Labs"),
  org("o2", "Alpha Institute"),
  org("o3", "Mid Corp"),
];

function setup(
  props: Partial<React.ComponentProps<typeof OrganisationPicker>> = {},
) {
  const onChange = vi.fn();
  render(
    <OrganisationPicker
      id="picker"
      organisations={ORGANISATIONS}
      value={[]}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

function searchBox(): HTMLElement {
  return screen.getByRole("combobox", { name: "Add organisation" });
}

describe("OrganisationPicker", () => {
  it("lists the selected organisations by name, alphabetically", () => {
    setup({ value: ["o1", "o2"] });
    const chips = screen.getAllByTestId("organisation-chip");
    expect(chips.map((c) => c.textContent)).toEqual([
      expect.stringContaining("Alpha Institute"),
      expect.stringContaining("Zeta Labs"),
    ]);
  });

  it("offers only the organisations not already picked", async () => {
    const user = userEvent.setup();
    setup({ value: ["o1"] });
    await user.click(searchBox());
    expect(
      screen.getByRole("option", { name: "Alpha Institute" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Zeta Labs" }),
    ).not.toBeInTheDocument();
  });

  it("appends the chosen organisation rather than replacing the selection", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: ["o1"] });
    await user.click(searchBox());
    await user.click(screen.getByRole("option", { name: "Mid Corp" }));
    expect(onChange).toHaveBeenCalledWith(["o1", "o3"]);
  });

  it("clears its search box after a pick, ready for the next one", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(searchBox());
    await user.type(searchBox(), "mid");
    await user.click(screen.getByRole("option", { name: "Mid Corp" }));
    expect(searchBox()).toHaveValue("");
  });

  it("removes one affiliation without disturbing the others", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: ["o1", "o2"] });
    await user.click(screen.getByRole("button", { name: "Remove Zeta Labs" }));
    expect(onChange).toHaveBeenCalledWith(["o2"]);
  });

  it("says so when nothing is picked", () => {
    setup();
    expect(screen.getByText("No organisations")).toBeInTheDocument();
    expect(screen.queryByTestId("organisation-chip")).not.toBeInTheDocument();
  });

  it("offers a create row only when the caller can create organisations", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    setup({ onCreate });
    await user.click(searchBox());
    await user.type(searchBox(), "Brand New Org");
    await user.click(
      screen.getByRole("option", { name: 'Add "Brand New Org"' }),
    );
    expect(onCreate).toHaveBeenCalledWith("Brand New Org");
  });

  it("has no create row without an onCreate handler", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(searchBox());
    await user.type(searchBox(), "Brand New Org");
    expect(
      screen.queryByRole("option", { name: /^Add / }),
    ).not.toBeInTheDocument();
  });

  it("shows the names read-only when disabled", () => {
    setup({ value: ["o1"], disabled: true });
    expect(screen.getByText("Zeta Labs")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Zeta Labs" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
