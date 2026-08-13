/**
 * Confirmation dialog for deleting a pitch.
 *
 * Deleting a pitch takes its assessments, meetings and stage history with it and
 * cannot be undone, so the confirm control stays disabled until the user has
 * typed the pitch's title back exactly.
 */

import { useEffect, useRef, useState } from "react";

interface DeletePitchModalProps {
  pitchTitle: string;
  meetingCount: number;
  assessmentCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  error?: string;
  deleting?: boolean;
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

export default function DeletePitchModal({
  pitchTitle,
  meetingCount,
  assessmentCount,
  onCancel,
  onConfirm,
  error,
  deleting = false,
}: DeletePitchModalProps): React.JSX.Element {
  const [typed, setTyped] = useState<string>("");
  const panelRef = useRef<HTMLDivElement>(null);
  const matches = typed.trim() === pitchTitle.trim();

  // Close on Escape, mirroring the dismissal behaviour of the stage menu.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel]);

  const inputClass =
    "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-red-300";
  const labelClass = "block text-sm font-medium text-navy-700 mb-1";

  return (
    <div
      data-testid="delete-pitch-overlay"
      onMouseDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onCancel();
      }}
      className="fixed inset-0 z-50 bg-navy-900/40 flex items-center justify-center p-4"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-pitch-heading"
        className="bg-white rounded-xl border border-navy-100 shadow-lg w-full max-w-md p-6"
      >
        <h2
          id="delete-pitch-heading"
          className="text-lg font-semibold text-navy-900 mb-2"
        >
          Delete pitch
        </h2>

        <p className="text-sm text-navy-600 mb-4">
          This permanently deletes{" "}
          <span className="font-medium text-navy-900">{pitchTitle}</span> and
          its {plural(assessmentCount, "assessment")},{" "}
          {plural(meetingCount, "meeting")} and its stage history. This cannot
          be undone.
        </p>

        <div className="mb-4">
          <label htmlFor="delete-pitch-confirm" className={labelClass}>
            Type <span className="font-semibold">{pitchTitle}</span> to confirm
          </label>
          <input
            id="delete-pitch-confirm"
            type="text"
            autoComplete="off"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
            }}
            className={inputClass}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="border border-navy-200 text-navy-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || deleting}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete pitch"}
          </button>
        </div>
      </div>
    </div>
  );
}
