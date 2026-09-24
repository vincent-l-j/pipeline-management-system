/**
 * The combobox under a real finger.
 *
 * Combobox.test.tsx already covers the mouse and the keyboard in jsdom. This
 * file exists for the one thing jsdom cannot model: a touchscreen tap is not a
 * click. It arrives as pointerdown, touchstart, pointerup, touchend and only
 * then the compatibility mousedown — so the component's "commit on mousedown,
 * before the blur closes the list" trick is being asked to work off an event
 * that fires after the finger has already lifted.
 *
 * What a headless Chromium still cannot give us is a soft keyboard, so the two
 * hazards that need one — blur while the keyboard opens, and the list rendering
 * behind it — are not asserted here. See the findings on the ticket.
 */

import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import Combobox from "../Combobox";

const OPTIONS = [
  { value: "1", label: "Acme Research" },
  { value: "2", label: "Beta Institute" },
  { value: "3", label: "Rozetta Institute" },
];

// Enough to overflow the list's own max height, which is what makes the
// scrollable-list assertion below mean anything.
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
  const id = page.getByRole("option", { name }).element().id;
  await commands.tap(`#${id}`);
}

const list = () => document.querySelector('[role="listbox"]');

/** The open list, for the assertions that measure it rather than count it. */
function openList(): HTMLElement {
  const box = document.querySelector<HTMLElement>('[role="listbox"]');
  if (!box) throw new Error("the list is closed");
  return box;
}

// Same reason as Layout.browser.test.tsx: a real tap updates state outside
// act(), and that is the rendering a user actually gets.
beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(() => {
  cleanup();
});

describe("Combobox under touch", () => {
  // Guards the file: without touch, page.tap is illegal and every test below
  // would be asserting about a mouse.
  it("runs on a touch-capable browser", () => {
    expect(navigator.maxTouchPoints).toBeGreaterThan(0);
  });

  it("opens the list when the field is tapped", async () => {
    setup();
    await commands.tap("#org");

    await expect
      .element(page.getByRole("combobox", { name: "Organisation" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(list()).not.toBeNull();
  });

  it("commits the option that was tapped", async () => {
    const { onChange } = setup();
    await commands.tap("#org");

    await tapOption("Beta Institute");

    expect(onChange).toHaveBeenCalledWith("2");
    expect(list()).toBeNull();
  });

  // The soft keyboard is tied to focus, so a selection that moved focus off the
  // field would dismiss and re-raise it mid-flow. It must not.
  it("leaves focus on the field after a tapped selection", async () => {
    setup();
    await commands.tap("#org");

    await tapOption("Acme Research");

    expect(document.activeElement?.id).toBe("org");
  });

  // A finger is not a mouse pointer: it rolls a few pixels between touchdown and
  // lift. Chromium still calls that a tap, and so must the list.
  it("commits an option even when the finger drifts on the way up", async () => {
    const { onChange } = setup();
    await commands.tap("#org");
    const row = page
      .getByRole("option", { name: "Rozetta Institute" })
      .element();
    const box = row.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;

    await commands.touchDrag(x, y, x, y + 8);

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
    expect(list()).toBeNull();
  });

  it("closes on Escape without submitting the surrounding form", async () => {
    const { onSubmit } = setup();
    await commands.tap("#org");
    expect(list()).not.toBeNull();

    await userEvent.keyboard("{Escape}");

    expect(list()).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // Asserted as geometry rather than by dragging: Vitest runs the test in an
  // iframe that CDP's synthesized scroll gestures do not reach, and a plain
  // overflow-auto div fails a touch-drag there identically, so a drag would be
  // measuring the harness. Overflowing content in a scrollable box is the fact
  // that makes the rest of the list reachable.
  it("keeps a long list scrollable rather than clipped", async () => {
    setup({ options: MANY });
    await commands.tap("#org");

    const box = openList();
    expect(getComputedStyle(box).overflowY).toBe("auto");
    expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
  });

  it("stays within the fold at the 360px design floor", async () => {
    setup({ options: MANY });
    await commands.tap("#org");

    expect(openList().getBoundingClientRect().bottom).toBeLessThanOrEqual(
      window.innerHeight,
    );
  });
});
