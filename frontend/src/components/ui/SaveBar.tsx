/** A form's actions, pinned to the bottom of the screen on a phone. */

import { ReactNode } from "react";

interface SaveBarProps {
  children: ReactNode;
}

export default function SaveBar({ children }: SaveBarProps): React.JSX.Element {
  return (
    <div
      data-testid="save-bar"
      className="sticky bottom-0 flex gap-3 border-t border-navy-100 bg-gray-50 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] print:hidden md:static md:border-0 md:bg-transparent md:pt-0 md:pb-0"
    >
      {children}
    </div>
  );
}
