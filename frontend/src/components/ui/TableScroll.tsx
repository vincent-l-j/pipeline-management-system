/**
 * A table too wide for the screen, scrolled sideways inside its own container
 * rather than pushing the page out past the viewport.
 *
 * Wrapping, not restructuring: the print stylesheet carries table-specific
 * rules that a card stack would break.
 */

import type { ReactNode } from "react";

interface TableScrollProps {
  children: ReactNode;
  /** Pads the foot, so a dropdown opening out of a row is not clipped away. */
  dropdownRoom?: boolean;
}

export default function TableScroll({
  children,
  dropdownRoom = false,
}: TableScrollProps): React.JSX.Element {
  // print:overflow-visible — paper has no scrollbar, so a container that clips
  // on screen would drop every column past the page edge from the print-out.
  return (
    <div
      // The scrolling box has no role of its own, and a gesture has to be aimed
      // at a selector.
      data-testid="table-scroll"
      className={`overflow-x-auto print:overflow-visible ${
        // Matches the dropdown's own max height; no gap on paper, where nothing
        // is open.
        dropdownRoom ? "pb-60 print:pb-0" : ""
      }`}
    >
      {children}
    </div>
  );
}
