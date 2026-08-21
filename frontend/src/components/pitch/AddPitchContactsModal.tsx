/**
 * Attach contacts to a pitch from the pitch's own page.
 *
 * Adds only: the people already on the pitch are kept and never offered, so no
 * pick in here can detach anyone. Removing is the card's own job.
 */

import { useEffect, useRef, useState } from "react";
import ContactPicker from "../contacts/ContactPicker";
import ContactQuickCreateModal from "../contacts/ContactQuickCreateModal";
import api from "../../services/api";
import { apiErrorMessage } from "../../services/apiError";
import type { Contact } from "../../types";

interface AddPitchContactsModalProps {
  pitchId: string;
  /** Every contact on file, for the picker's options. */
  contacts: Contact[];
  /** The contacts already on the pitch: kept on save, never offered. */
  attachedIds: string[];
  /** A contact created in here, so the caller's directory can name them. */
  onContactCreated: (contact: Contact) => void;
  /** The pitch's contact ids as the server reports them after the save. */
  onSaved: (contactIds: string[]) => void;
  onCancel: () => void;
}

export default function AddPitchContactsModal({
  pitchId,
  contacts,
  attachedIds,
  onContactCreated,
  onSaved,
  onCancel,
}: AddPitchContactsModalProps): React.JSX.Element {
  const [picked, setPicked] = useState<string[]>([]);
  const [created, setCreated] = useState<Contact[]>([]);
  const [creatingFrom, setCreatingFrom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const quickCreateOpen = creatingFrom !== null;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // The inner dialog owns Escape while it is up; it closes itself.
      if (e.key === "Escape" && !quickCreateOpen) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel, quickCreateOpen]);

  // Once, on open: the picker is the only thing to do in here.
  useEffect(() => {
    pickerRef.current?.querySelector("input")?.focus();
  }, []);

  // Deduplicated by id: a caller that folds a created contact into its own
  // directory hands them straight back as a prop, and the picker cannot show
  // one person as two chips.
  const pool = [...contacts, ...created].filter(
    (contact, index, all) =>
      !attachedIds.includes(contact.id) &&
      all.findIndex((other) => other.id === contact.id) === index,
  );

  function contactCreated(contact: Contact): void {
    // Kept locally as well as handed up: the picker names chips from the list
    // it is given, so without this the new contact is picked but nameless.
    setCreated((prev) => [...prev, contact]);
    setPicked((prev) => [...prev, contact.id]);
    setCreatingFrom(null);
    onContactCreated(contact);
  }

  async function save(): Promise<void> {
    if (picked.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      // The endpoint replaces the whole set, so the attached ids go back out
      // with the new ones. Its answer is reported up, not ours: it deduplicates.
      const { data } = await api.patch<{ contact_ids?: string[] }>(
        `/pitches/${pitchId}`,
        { contact_ids: [...attachedIds, ...picked] },
      );
      onSaved(data.contact_ids ?? [...attachedIds, ...picked]);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to add contacts"));
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="add-pitch-contacts-overlay"
      onMouseDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onCancel();
      }}
      className="fixed inset-0 z-50 bg-navy-900/40 flex items-center justify-center p-4"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-pitch-contacts-heading"
        className="bg-white rounded-xl border border-navy-100 shadow-lg w-full max-w-md p-6"
      >
        <h2
          id="add-pitch-contacts-heading"
          className="text-lg font-semibold text-navy-900 mb-1"
        >
          Add contacts
        </h2>
        <p className="text-sm text-navy-500 mb-4">
          Pick anyone already on file, or add someone new. The contacts already
          on this pitch stay as they are.
        </p>

        <div ref={pickerRef}>
          <ContactPicker
            id="add-pitch-contacts-picker"
            contacts={pool}
            value={picked}
            onChange={setPicked}
            onCreate={setCreatingFrom}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mt-4">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="border border-navy-200 text-navy-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void save();
            }}
            disabled={saving || picked.length === 0}
            className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add to pitch"}
          </button>
        </div>

        {/* A descendant on purpose: it keeps this dialog's outside-click from
            firing when the inner one is clicked. */}
        {creatingFrom !== null && (
          <ContactQuickCreateModal
            initialQuery={creatingFrom}
            onCreated={contactCreated}
            onCancel={() => {
              setCreatingFrom(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
