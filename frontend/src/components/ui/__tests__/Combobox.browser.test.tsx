import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import Combobox from "../Combobox";

const OPTIONS = [
  { value: "1", label: "Acme Research" },
  { value: "2", label: "Beta Institute" },
  { value: "3", label: "Rozetta Institute" },
];

// Enough to overflow the list's own max height, so the scroll assertion below
// is measuring a list that actually needs scrolling.
const MANY = Array.from({ length: 30 }, (_, i) => ({
  value: `many-${String(i)}`,
  label: `Organisation number ${String(i)}`,
}));

function setup(props: Partial<React.ComponentProps<typeof Combobox>> = {}) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  render(
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
        {...props}
      />
    </form>,
  );
  return { onChange, onSubmit };
}

/** Taps by accessible name: the row is found as a user finds it, then touched. */
async function tapOption(name: string) {
  await commands.tap(`#${page.getByRole("option", { name }).element().id}`);
}

const listbox = () => page.getByRole("listbox");

// Registered after React Testing Library's own act-environment beforeAll, so
// this wins: a real tap updates state outside act(), and that is the rendering
// a user actually gets.
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(() => {
  cleanup();
});

// A touchscreen tap is not a click: it arrives as pointerdown, touchstart,
// pointerup, touchend and only then the compatibility mousedown. The component
// commits on mousedown to beat its own blur-close, so that trick is being asked
// to work off an event that fires after the finger has already lifted.
describe("Combobox under touch", () => {
  // Without touch, commands.tap throws from Playwright rather than failing here.
  it("runs on a touch-capable browser", () => {
    expect(navigator.maxTouchPoints).toBeGreaterThan(0);
  });

  it("opens the list when the field is tapped", async () => {
    setup();
    await commands.tap("#org");

    await expect
      .element(page.getByRole("combobox", { name: "Organisation" }))
      .toHaveAttribute("aria-expanded", "true");
    await expect.element(listbox()).toBeInTheDocument();
  });

  it("commits the option that was tapped", async () => {
    const { onChange } = setup();
    await commands.tap("#org");

    await tapOption("Beta Institute");

    expect(onChange).toHaveBeenCalledWith("2");
    await expect.element(listbox()).not.toBeInTheDocument();
  });

  // The soft keyboard is tied to focus, so a selection that moved focus off the
  // field would dismiss and re-raise it mid-flow. It must not.
  it("leaves focus on the field after a tapped selection", async () => {
    setup();
    await commands.tap("#org");

    await tapOption("Acme Research");

    await expect.poll(() => document.activeElement?.id).toBe("org");
  });

  // A finger rolls a few pixels between touchdown and lift. Chromium still calls
  // that a tap, and so must the list.
  it("commits an option even when the finger drifts on the way up", async () => {
    const { onChange } = setup();
    await commands.tap("#org");
    const box = page
      .getByRole("option", { name: "Rozetta Institute" })
      .element()
      .getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;

    await commands.touchDrag({ x, y }, { x, y: y + 8 });

    expect(onChange).toHaveBeenCalledWith("3");
  });

  it("invokes the create callback when the create row is tapped", async () => {
    const onCreate = vi.fn();
    const { onChange } = setup({
      onCreate,
      createLabel: (query) => (query ? `Add "${query}"` : "Add a new one"),
    });
    await commands.tap("#org");

    await tapOption("Add a new one");

    expect(onCreate).toHaveBeenCalledWith("");
    expect(onChange).not.toHaveBeenCalled();
    await expect.element(listbox()).not.toBeInTheDocument();
  });

  it("closes on Escape without submitting the surrounding form", async () => {
    const { onSubmit } = setup();
    await commands.tap("#org");
    await expect.element(listbox()).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await expect.element(listbox()).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // A scroll container clips on both axes, and a row clipped away is still laid
  // out with a rectangle of its own — so this asks what is under the finger.
  it("stays tappable where a scroll container would clip the list", async () => {
    render(
      <div className="overflow-x-auto">
        <Combobox
          id="org"
          ariaLabel="Organisation"
          options={OPTIONS}
          value=""
          onChange={vi.fn()}
        />
      </div>,
    );
    await commands.tap("#org");

    const option = page.getByRole("option", { name: "Beta Institute" });
    const { left, top, width, height } = option
      .element()
      .getBoundingClientRect();
    const atOption = document.elementFromPoint(
      left + width / 2,
      top + height / 2,
    );
    expect(option.element().contains(atOption)).toBe(true);
  });

  // Measured rather than dragged: Vitest runs the test in an iframe that CDP's
  // synthesized scroll gestures do not reach, and a plain overflow-auto div
  // fails a touch-drag there identically, so a drag would be measuring the
  // harness. Overflowing content in a scrolling box is what a finger needs.
  it("keeps a long list scrollable rather than clipping the overflow", async () => {
    setup({ options: MANY });
    await commands.tap("#org");

    const box = listbox().element();
    expect(getComputedStyle(box).overflowY).toBe("auto");
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
  });
});
