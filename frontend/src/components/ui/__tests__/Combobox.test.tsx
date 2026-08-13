import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Combobox, { ComboboxOption } from "../Combobox";

const OPTIONS: ComboboxOption[] = [
  { value: "1", label: "Acme Research" },
  { value: "2", label: "Beta Institute" },
  { value: "3", label: "Rozetta Institute" },
  { value: "4", label: "Rozetta Institute (NSW)" },
];

function setup(
  props: Partial<React.ComponentProps<typeof Combobox>> = {},
  onSubmit = vi.fn(),
) {
  const onChange = vi.fn();
  const utils = render(
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="org">Organisation</label>
      <Combobox
        id="org"
        options={OPTIONS}
        value=""
        onChange={onChange}
        placeholder="Select organisation..."
        {...props}
      />
    </form>,
  );
  const input = screen.getByRole("combobox", { name: "Organisation" });
  return { onChange, onSubmit, input, ...utils };
}

describe("Combobox", () => {
  it("shows the selected option's label when closed", () => {
    setup({ value: "3" });
    expect(screen.getByRole("combobox", { name: "Organisation" })).toHaveValue(
      "Rozetta Institute",
    );
  });

  it("reports itself as collapsed until opened", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("narrows the options as the user types", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);
    await user.type(input, "rozetta");

    expect(
      screen.getByRole("option", { name: "Rozetta Institute" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Acme Research" }),
    ).not.toBeInTheDocument();
  });

  it("matches without regard to case or position in the name", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);
    await user.type(input, "INSTIT");

    expect(
      screen.getByRole("option", { name: "Beta Institute" }),
    ).toBeInTheDocument();
  });

  it("reports the chosen value and closes the list", async () => {
    const user = userEvent.setup();
    const { input, onChange } = setup();
    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Beta Institute" }));

    expect(onChange).toHaveBeenCalledWith("2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("commits a choice made on mousedown, before the blur can close the list", () => {
    // Selecting on click would lose the race against the blur-close: the list
    // unmounts first and the click never lands on an option.
    const { input, onChange } = setup();
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole("option", { name: "Acme Research" }));
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("moves the highlight with the arrow keys and names it for assistive tech", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);

    const first = screen.getByRole("option", { name: "Acme Research" });
    expect(input).toHaveAttribute("aria-activedescendant", first.id);

    await user.keyboard("{ArrowDown}");
    const second = screen.getByRole("option", { name: "Beta Institute" });
    expect(input).toHaveAttribute("aria-activedescendant", second.id);
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", first.id);
  });

  it("opens on ArrowDown when closed rather than moving an invisible highlight", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    input.focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("selects the highlighted option on Enter WITHOUT submitting the form", async () => {
    const user = userEvent.setup();
    const { input, onChange, onSubmit } = setup();
    await user.click(input);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("2");
    // The combobox lives inside the pitch form; Enter must not save the pitch.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit the form on Enter even when nothing matches", async () => {
    const user = userEvent.setup();
    const { input, onSubmit } = setup({ onCreate: undefined });
    await user.click(input);
    await user.type(input, "nothing matches this");
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes on Escape and keeps the current selection", async () => {
    const user = userEvent.setup();
    const { input, onChange } = setup({ value: "3" });
    await user.click(input);
    await user.type(input, "beta");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // The typed text reverts; the selection is untouched.
    expect(input).toHaveValue("Rozetta Institute");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps Escape from reaching a surrounding dialog while the list is open", async () => {
    const user = userEvent.setup();
    const onOuterEscape = vi.fn();
    render(
      <div
        onKeyDown={(e) => {
          if (e.key === "Escape") onOuterEscape();
        }}
      >
        <label htmlFor="org2">Organisation</label>
        <Combobox id="org2" options={OPTIONS} value="" onChange={vi.fn()} />
      </div>,
    );
    const input = screen.getByRole("combobox", { name: "Organisation" });

    await user.click(input);
    await user.keyboard("{Escape}");
    expect(onOuterEscape).not.toHaveBeenCalled();

    // Once closed, Escape is no longer ours — the dialog should get it.
    await user.keyboard("{Escape}");
    expect(onOuterEscape).toHaveBeenCalled();
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);
    await user.type(input, "zzzz");

    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("is inert when disabled", async () => {
    const user = userEvent.setup();
    const { input } = setup({ disabled: true });
    expect(input).toBeDisabled();
    await user.click(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  describe("inline create", () => {
    const createProps = {
      onCreate: vi.fn(),
      createLabel: (query: string) =>
        query
          ? `Add "${query}" as a new organisation`
          : "Add a new organisation",
    };

    it("offers the create row even when the typed text matches existing options", async () => {
      const user = userEvent.setup();
      const { input } = setup(createProps);
      await user.click(input);
      await user.type(input, "Rozetta Institute");

      // Two near-duplicates match, and the user still needs a third.
      expect(
        screen.getByRole("option", { name: "Rozetta Institute" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", {
          name: 'Add "Rozetta Institute" as a new organisation',
        }),
      ).toBeInTheDocument();
    });

    it("offers the create row when nothing matches", async () => {
      const user = userEvent.setup();
      const { input } = setup(createProps);
      await user.click(input);
      await user.type(input, "Brand New Org");

      expect(
        screen.getByRole("option", {
          name: 'Add "Brand New Org" as a new organisation',
        }),
      ).toBeInTheDocument();
      expect(screen.queryByText("No matches")).not.toBeInTheDocument();
    });

    it("offers the create row with nothing typed", async () => {
      const user = userEvent.setup();
      const { input } = setup(createProps);
      await user.click(input);

      expect(
        screen.getByRole("option", { name: "Add a new organisation" }),
      ).toBeInTheDocument();
    });

    it("hands the typed text to the create handler", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      const { input } = setup({ ...createProps, onCreate });
      await user.click(input);
      await user.type(input, "Brand New Org");
      await user.click(
        screen.getByRole("option", {
          name: 'Add "Brand New Org" as a new organisation',
        }),
      );

      expect(onCreate).toHaveBeenCalledWith("Brand New Org");
    });

    it("reaches the create row from the keyboard without submitting the form", async () => {
      const user = userEvent.setup();
      const onCreate = vi.fn();
      const { input, onSubmit } = setup({ ...createProps, onCreate });
      await user.click(input);
      await user.type(input, "Brand New Org");
      // Nothing matches, so the create row is the only row and starts highlighted.
      await user.keyboard("{Enter}");

      expect(onCreate).toHaveBeenCalledWith("Brand New Org");
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("does not report a value change when the create row is chosen", async () => {
      const user = userEvent.setup();
      const { input, onChange } = setup({ ...createProps, onCreate: vi.fn() });
      await user.click(input);
      await user.type(input, "Brand New Org");
      await user.keyboard("{Enter}");

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
