import { commands, page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import TableScroll from "../TableScroll";

/** Wider than 360px however the columns are measured. */
const ROWS = [
  "alexandra.mcconnell@example.com",
  "bartholomew.wintergreen@example.com",
  "charlotte.fitzwilliam@example.com",
];

function renderWideTable() {
  render(
    <TableScroll>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left">Contact</th>
            <th className="px-4 py-3 text-left">Organisation</th>
            <th className="px-4 py-3 text-left">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((email) => (
            <tr key={email}>
              <td className="px-4 py-3">{email}</td>
              <td className="px-4 py-3">Wintergreen Innovation Partners</td>
              <td className="px-4 py-3">12 September 2026</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>,
  );
  return page.getByTestId("table-scroll").element();
}

/** `commands` aim at a selector, not at an element. */
const SCROLLER = '[data-testid="table-scroll"]';

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(async () => {
  cleanup();
  // Media emulation outlives the test that set it; the page is file-wide.
  await commands.emulateMedia("screen");
});

describe("a table too wide for a 360px screen", () => {
  // Scrolled by a gesture, never by assigning `scrollLeft`: a clipped container
  // takes that just as happily, so it would prove nothing.
  it("scrolls sideways within its own container", async () => {
    const container = renderWideTable();

    await commands.scrollX(SCROLLER, 200);

    await expect.poll(() => container.scrollLeft).toBeGreaterThan(0);
  });

  it("leaves the page itself unscrollable sideways", () => {
    renderWideTable();

    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  });

  it("brings the last column into view once scrolled", async () => {
    renderWideTable();
    const lastHeader = page.getByText("Submitted");

    await commands.scrollX(SCROLLER, 9999);

    // Rounded: a fractional column width leaves the last edge a fifth of a
    // pixel past the viewport, which no reader can see.
    await expect
      .poll(() => {
        const { right } = lastHeader.element().getBoundingClientRect();
        return Math.round(right);
      })
      .toBeLessThanOrEqual(window.innerWidth);
    expect(lastHeader.element().getBoundingClientRect().left).toBeGreaterThan(
      0,
    );
  });

  // On paper there is nothing to scroll, so a scrolling container would print
  // whatever fits and drop the rest. Assigned rather than gestured: the point is
  // that there is no scrolling area left to move at all.
  it("does not scroll on paper, so the whole table prints", async () => {
    const container = renderWideTable();

    await commands.emulateMedia("print");
    container.scrollLeft = 9999;

    expect(container.scrollLeft).toBe(0);
  });
});
