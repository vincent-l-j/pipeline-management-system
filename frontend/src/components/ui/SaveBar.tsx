/**
 * The row of form actions, pinned to the bottom of the viewport on a phone.
 *
 * These forms run several screens long on a 360px screen, so a save button that
 * sits after the last field is a button the user has to go looking for. Sticky
 * rather than fixed: it belongs to the form, so it stops at the form's end
 * instead of floating over whatever follows.
 *
 * It is a container and nothing else — the caller supplies its own buttons, so
 * a create page can say "Add Pitch" where an edit page says "Save Changes".
 *
 * Three details are easy to undo by accident:
 *   - `pb` adds `env(safe-area-inset-bottom)`, or the buttons sit under the
 *     gesture bar on a handset that has one. `index.html` opts the viewport in
 *     with `viewport-fit=cover`, which is what makes the inset resolve.
 *   - `print:hidden`, because the print stylesheet hides buttons but not their
 *     container, which would otherwise print as a rule and a grey band.
 *   - From `md` up it is a plain static row again, so the desktop form looks
 *     exactly as it did before the bar existed.
 */

import { ReactNode } from "react";

interface SaveBarProps {
  children: ReactNode;
}

export default function SaveBar({ children }: SaveBarProps): React.JSX.Element {
  return (
    <div
      data-testid="save-bar"
      className="sticky bottom-0 flex gap-3 border-t border-navy-100 bg-gray-50 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] print:hidden md:static md:border-0 md:bg-transparent md:pt-2 md:pb-0"
    >
      {children}
    </div>
  );
}
