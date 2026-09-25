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
}

export default function TableScroll({
  children,
}: TableScrollProps): React.JSX.Element {
  // print:overflow-visible — paper has no scrollbar, so a container that clips
  // on screen would drop every column past the page edge from the print-out.
  return (
    <div
      // The scrolling box has no role of its own, and a gesture has to be aimed
      // at a selector.
      data-testid="table-scroll"
      className="overflow-x-auto print:overflow-visible"
    >
      {children}
    </div>
  );
}
