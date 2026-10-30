import { page } from "vitest/browser";
import { render } from "@testing-library/react";
import ScoreSelector from "../ScoreSelector";
import { CRITERIA } from "../AssessmentConfig";

/**
 * The narrow half of these rules is covered on the pages that use the
 * selector; this file guards the `md:` side, which the 360px instance cannot
 * reach.
 */

const SCORES = [1, 2, 3, 4, 5];

function showSelector() {
  render(
    <ScoreSelector criterion={CRITERIA[0]} value={3} onChange={vi.fn()} />,
  );
}

describe("the score selector above the md breakpoint", () => {
  it("runs at a width md applies at", () => {
    expect(window.innerWidth).toBeGreaterThanOrEqual(768);
  });

  it("shows the score bar", () => {
    showSelector();

    expect(page.getByTestId("score-bar").element().checkVisibility()).toBe(
      true,
    );
  });

  it.each(SCORES)("keeps score %i at its 40px desktop size", (score) => {
    showSelector();

    const { width, height } = page
      .getByRole("button", { name: String(score), exact: true })
      .element()
      .getBoundingClientRect();

    expect(width).toBe(40);
    expect(height).toBe(40);
  });
});
