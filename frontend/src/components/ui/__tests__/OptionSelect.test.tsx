import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OptionSelect, { SelectOption } from "../OptionSelect";

const OPTIONS: SelectOption[] = [
  { value: "crc_bid", label: "CRC Bid" },
  { value: "rdti", label: "RDTI" },
  { value: "private", label: "Private" },
];

function setup(props: Partial<React.ComponentProps<typeof OptionSelect>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <OptionSelect
      id="funding"
      label="Funding Pathway"
      options={OPTIONS}
      value=""
      onChange={onChange}
      placeholder="Select funding pathway..."
      {...props}
    />,
  );
  const select = screen.getByRole("combobox", { name: "Funding Pathway" });
  return { onChange, select, ...utils };
}

describe("OptionSelect", () => {
  // The htmlFor/id pairing every call site's tests reach the field through.
  it("labels the select so it is reachable by name", () => {
    const { select } = setup();
    expect(screen.getByLabelText("Funding Pathway")).toBe(select);
  });

  it("offers the placeholder ahead of the supplied options", () => {
    setup();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Select funding pathway...",
      "CRC Bid",
      "RDTI",
      "Private",
    ]);
  });

  it("offers no blank option when no placeholder is given", () => {
    setup({ placeholder: undefined, value: "rdti" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "CRC Bid",
      "RDTI",
      "Private",
    ]);
  });

  it("shows the option matching the current value", () => {
    const { select } = setup({ value: "rdti" });
    expect(select).toHaveValue("rdti");
    expect(select).toHaveDisplayValue("RDTI");
  });

  it("shows the placeholder while nothing is selected", () => {
    const { select } = setup();
    expect(select).toHaveDisplayValue("Select funding pathway...");
  });

  it("reports the chosen option's value, not its label", async () => {
    const user = userEvent.setup();
    const { onChange, select } = setup();
    await user.selectOptions(select, "rdti");
    expect(onChange).toHaveBeenCalledWith("rdti");
  });

  // The payload that clears a field: a caller patching "" back to null relies on it.
  it("reports an empty string when the placeholder is chosen back", async () => {
    const user = userEvent.setup();
    const { onChange, select } = setup({ value: "rdti" });
    await user.selectOptions(select, "");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("is enabled unless the caller says otherwise", () => {
    expect(setup().select).toBeEnabled();
  });

  it("is disabled when the caller says so", () => {
    expect(setup({ disabled: true }).select).toBeDisabled();
  });

  it("is not required unless the caller says so", () => {
    expect(setup().select).not.toBeRequired();
  });

  it("marks the field required when the caller says so", () => {
    expect(setup({ required: true }).select).toBeRequired();
  });
});
