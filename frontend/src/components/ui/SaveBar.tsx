/** A form's actions, pinned to the bottom of the screen on a phone. */

import { ReactNode } from "react";

interface SaveBarProps {
  children: ReactNode;
}

export default function SaveBar({ children }: SaveBarProps): React.JSX.Element {
  return (
    <div
      // No role of its own, and the print check has to aim at the container
      // rather than the buttons the print stylesheet already hides.
      data-testid="save-bar"
      // Sticky, not fixed, so it stops at the form's end rather than floating
      // over whatever follows. `pb` clears the gesture bar (`index.html` carries
      // the `viewport-fit=cover` that makes the inset resolve); `print:hidden`
      // because the print stylesheet hides buttons but not their container; and
      // from `md` it is the plain static row it was before.
      className="sticky bottom-0 flex gap-3 border-t border-navy-100 bg-gray-50 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] print:hidden md:static md:border-0 md:bg-transparent md:pt-2 md:pb-0"
    >
      {children}
    </div>
  );
}
