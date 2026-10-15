import { page } from "vitest/browser";
import { render } from "@testing-library/react";
import PitchFormFields from "../PitchFormFields";
import { EMPTY_PITCH_FORM } from "../pitchForm";

/**
 * The component is presentational, so this renders it directly rather than the
 * page: the grid is the only thing under test and it needs no lookups.
 */

/** Grid order, so each row is the pair the layout puts side by side. */
const PAIRS: [left: string, right: string][] = [
  ["Submission Date", "Source"],
  ["Pitch Request", "Funding Pathway"],
  ["Organisation", "Rozetta Lead"],
];

function showFields() {
  render(
    <PitchFormFields
      values={EMPTY_PITCH_FORM}
      onChange={vi.fn()}
      organisations={[]}
      contacts={[]}
      users={[]}
    />,
  );
}

describe("the pitch field grid above the sm breakpoint", () => {
  it("runs at a width the second column applies at", () => {
    expect(window.innerWidth).toBeGreaterThanOrEqual(640);
  });

  it.each(PAIRS)("puts %s and %s on one row", (left, right) => {
    showFields();

    const first = page.getByLabelText(left).element().getBoundingClientRect();
    const second = page.getByLabelText(right).element().getBoundingClientRect();

    expect(second.top).toBe(first.top);
    expect(second.left).toBeGreaterThanOrEqual(first.right);
  });
});
