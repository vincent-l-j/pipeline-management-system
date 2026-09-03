/**
 * A pitch's attachments: drop a file on the pitch and see it attached.
 *
 * Distinct from `FileLinks` next to it, which records a path to a file kept
 * somewhere else. These files are really uploaded, to the document library.
 */

import { useEffect, useState } from "react";
import {
  deleteAttachment,
  downloadAttachment,
  listAttachments,
  uploadAttachment,
} from "../../services/api";
import { apiErrorMessage } from "../../services/apiError";
import { useAuth } from "../../contexts/AuthContext";
import type { Attachment } from "../../types";

interface PitchAttachmentsProps {
  pitchId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PitchAttachments({
  pitchId,
}: PitchAttachmentsProps): React.JSX.Element {
  const { user } = useAuth();
  const [rows, setRows] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<boolean>(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // UX only. The server refuses a viewer's upload and delete on a direct
  // request, and that refusal — not this flag — is what protects them.
  const canEdit: boolean = user?.role === "admin" || user?.role === "assessor";

  useEffect((): void => {
    setLoading(true);
    setLoadError(null);
    listAttachments(pitchId)
      .then((data): void => {
        setRows(data);
      })
      .catch((err: unknown): void => {
        setLoadError(apiErrorMessage(err, "Could not load attachments"));
      })
      .finally((): void => {
        setLoading(false);
      });
  }, [pitchId]);

  async function attach(file: File): Promise<void> {
    setError(null);
    setProgress(0);
    try {
      const created = await uploadAttachment(pitchId, file, setProgress);
      // The row the server confirmed, prepended: the list updates in place, so
      // there is no re-fetch and nothing to reload.
      setRows((prev): Attachment[] => [created, ...prev]);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not attach the file"));
    } finally {
      // Always cleared, so a failed upload says what went wrong instead of
      // leaving the row stuck at a percentage that will never move.
      setProgress(null);
    }
  }

  async function download(row: Attachment): Promise<void> {
    setError(null);
    try {
      const blob = await downloadAttachment(pitchId, row.id);
      // An object URL and a synthetic click, because the endpoint needs the
      // bearer token — the browser cannot simply be pointed at the URL, and
      // pointing it at the document library instead is the thing the download
      // endpoint exists to prevent.
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = row.filename;
      link.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not download the file"));
    }
  }

  async function remove(row: Attachment): Promise<void> {
    setError(null);
    setRemoving(row.id);
    try {
      await deleteAttachment(pitchId, row.id);
      setRows((prev): Attachment[] =>
        prev.filter((r): boolean => r.id !== row.id),
      );
    } catch (err) {
      setError(apiErrorMessage(err, "Could not remove the file"));
    } finally {
      setRemoving(null);
    }
  }

  function dropped(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    // `.item(0)`, not `[0]`: a FileList index is typed as always present, so a
    // drop carrying no file would read as one and go straight to the server.
    const file = event.dataTransfer.files.item(0);
    if (file) void attach(file);
  }

  return (
    <div className="bg-white rounded-xl border border-navy-100 p-6">
      <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-3">
        Attachments ({String(rows.length)})
      </h2>

      {canEdit && (
        <div
          onDragOver={(event) => {
            // Without preventDefault the browser opens the file instead of
            // letting the drop reach this handler.
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={dropped}
          className={`relative mb-4 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragging ? "border-teal-500 bg-teal-50" : "border-navy-200"
          }`}
        >
          {/* One handle for both ways in: the input covers the zone, so a click
              anywhere opens the picker and a drop anywhere bubbles to the
              handlers above. Drag and drop is not the only way to attach a
              file. */}
          <input
            type="file"
            aria-label="Attach a file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void attach(file);
              // Cleared so choosing the same file twice fires onChange again.
              event.target.value = "";
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <p className="text-sm font-medium text-navy-600">
            {dragging
              ? "Drop to attach"
              : "Drop a file here, or click to choose one"}
          </p>
          <p className="text-xs text-navy-400 mt-1">
            Decks, documents, spreadsheets and images, up to 25 MB.
          </p>
        </div>
      )}

      {progress !== null && (
        <div className="mb-4">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
            className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100"
          >
            <div
              className="h-full bg-teal-500 transition-all"
              style={{ width: `${String(progress)}%` }}
            />
          </div>
          <p className="text-xs text-navy-500 mt-1">
            Uploading… {String(progress)}%
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-navy-400">Loading attachments...</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-navy-400">No files attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-navy-50/50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy-900 truncate">
                  {row.filename}
                </p>
                <p className="text-xs text-navy-400">
                  {formatSize(row.size_bytes)}
                  {row.uploaded_by_name ? ` · ${row.uploaded_by_name}` : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Download ${row.filename}`}
                onClick={() => {
                  void download(row);
                }}
                className="text-xs text-navy-600 hover:text-navy-900 font-medium"
              >
                Download
              </button>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Remove ${row.filename}`}
                  onClick={() => {
                    void remove(row);
                  }}
                  disabled={removing !== null}
                  className="text-navy-300 hover:text-red-600 leading-none px-1 transition-colors disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
