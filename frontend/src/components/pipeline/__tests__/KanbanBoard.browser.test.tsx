import { commands, page } from "vitest/browser";
import { cleanup, render } from "@testing-library/react";
import KanbanBoard from "../KanbanBoard";
import { PIPELINE_STAGES } from "../PipelineConfig";

vi.mock("../../../services/api", () => ({
  default: { post: vi.fn() },
}));

afterEach(async () => {
  cleanup();
  // Media emulation outlives the test that set it; the page is file-wide.
  await commands.emulateMedia("screen");
});

describe("printing the pipeline board", () => {
  // Guards the file: the board is wider than this many times over, which is
  // what makes it lose columns on paper.
  it("runs at the width the mobile layout was designed for", () => {
    expect(window.innerWidth).toBe(360);
  });

  // Paper has no scrollbar, so a column past the page edge is not shrunk or
  // wrapped by the printer — it is simply not printed.
  it.each(PIPELINE_STAGES.map((stage) => stage.label))(
    "puts the %s column inside the page",
    async (label) => {
      render(<KanbanBoard pitches={[]} onPitchMoved={vi.fn()} />);
      const heading = page.getByRole("heading", { name: label });

      await commands.emulateMedia("print");

      const { left, right } = heading.element().getBoundingClientRect();
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(window.innerWidth);
    },
  );
});
