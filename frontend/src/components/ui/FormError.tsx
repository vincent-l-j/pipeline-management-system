/**
 * Why a form's submit failed, announced and brought on screen.
 *
 * The banner sits above a form's first field, and on a phone the save is
 * tapped several screens below it — from a pinned SaveBar, or from the foot of
 * the form — so a failure that only rendered there would be off-screen: the
 * user taps save and nothing visibly happens. So each report scrolls the
 * banner into view, as little as it takes; on a desk the banner is usually
 * already in view and nothing moves. `role="alert"` announces it to assistive
 * technology without moving focus away from the button the user pressed.
 *
 * A report is an object rather than a bare string so that each one is new:
 * refusing the same submit twice sets the same message twice, and a string
 * equal to the last would neither re-render nor scroll the second time.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface FormErrorReport {
  message: string;
}

/** Holds a form's submit error; `setError` takes the message, or null to clear. */
export function useFormError(): [
  FormErrorReport | null,
  (message: string | null) => void,
] {
  const [report, setReport] = useState<FormErrorReport | null>(null);
  const setError = useCallback((message: string | null) => {
    setReport(message === null ? null : { message });
  }, []);
  return [report, setError];
}

interface FormErrorProps {
  error: FormErrorReport | null;
}

export default function FormError({
  error,
}: FormErrorProps): React.JSX.Element | null {
  const banner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    banner.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  if (!error) return null;

  return (
    <div
      ref={banner}
      role="alert"
      // Clear of the sticky mobile app bar (h-14), or "nearest" parks the
      // banner underneath it.
      className="scroll-mt-20 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3"
    >
      {error.message}
    </div>
  );
}
