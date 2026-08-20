/**
 * Create a contact without leaving the page that needed one.
 *
 * The sibling of OrganisationQuickCreateModal, and deliberately its twin: same
 * overlay, same Escape and outside-click handling, same "seed it from what was
 * typed into the picker" contract. A picker that can only choose from people
 * already on file sends the user away mid-task; this keeps them here.
 *
 * The owning page renders it as a sibling of any <form>, never nested inside
 * one: a form within a form is invalid, and this dialog's buttons would submit
 * the outer form.
 *
 * Being a sibling is not enough on its own. The dialog takes focus when it
 * opens, because the picker that opened it sits inside that form and Enter in a
 * still-focused picker submits it — saving the pitch behind a dialog the user is
 * only halfway through. Enter in a field here commits this dialog instead.
 *
 * Only the fields that tell two similar people apart in a picker are offered.
 * Phone, LinkedIn and notes belong on the Contacts page — asking for them here
 * would turn a two-second detour into a form.
 */

import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import { apiErrorMessage } from "../../services/apiError";
import type { Contact } from "../../types";
import { contactFromQuery } from "./quickContact";

interface ContactQuickCreateModalProps {
  /** The picker text this was opened from; split across the name fields. */
  initialQuery?: string;
  /** Organisations the new contact is affiliated with on creation. */
  organisationIds?: string[];
  onCreated: (contact: Contact) => void;
  onCancel: () => void;
}

export default function ContactQuickCreateModal({
  initialQuery = "",
  organisationIds = [],
  onCreated,
  onCancel,
}: ContactQuickCreateModalProps): React.JSX.Element {
  const seed = contactFromQuery(initialQuery);
  const [firstName, setFirstName] = useState(seed.first_name);
  const [lastName, setLastName] = useState(seed.last_name);
  const [email, setEmail] = useState(seed.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel]);

  // Once, on open: taking focus is what stops Enter reaching the form behind.
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function save(): Promise<void> {
    // The same rule the API enforces, so a doomed request is never sent. An
    // affiliation counts as a detail: "someone at Acme" is a contact worth
    // keeping, and this dialog is often opened from that organisation.
    const named = [firstName, lastName, email].some(
      (value) => value.trim() !== "",
    );
    if (!named && organisationIds.length === 0) {
      setError("A name or email is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post<Contact>("/contacts", {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        organisation_ids: organisationIds,
      });
      onCreated(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to add contact"));
      setSaving(false);
    }
  }

  /** Enter in a field commits the dialog, as it would in a form of its own.
   *  Buttons handle their own Enter, so they are left to it. */
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement && !saving) {
      e.preventDefault();
      void save();
    }
  }

  const inputClass =
    "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300";
  const labelClass = "block text-sm font-medium text-navy-700 mb-1";

  return (
    <div
      data-testid="contact-quick-create-overlay"
      onMouseDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onCancel();
      }}
      className="fixed inset-0 z-50 bg-navy-900/40 flex items-center justify-center p-4"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        onKeyDown={onKeyDown}
        aria-labelledby="contact-quick-create-heading"
        className="bg-white rounded-xl border border-navy-100 shadow-lg w-full max-w-md p-6"
      >
        <h2
          id="contact-quick-create-heading"
          className="text-lg font-semibold text-navy-900 mb-1"
        >
          Add contact
        </h2>
        <p className="text-sm text-navy-500 mb-4">
          They will be linked here straight away. You can record the rest on the
          Contacts page later.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="quick-contact-first-name">
                First name
              </label>
              <input
                id="quick-contact-first-name"
                ref={firstFieldRef}
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="quick-contact-last-name">
                Last name
              </label>
              <input
                id="quick-contact-last-name"
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                }}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="quick-contact-email">
              Email
            </label>
            <input
              id="quick-contact-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              className={inputClass}
            />
          </div>
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
            disabled={saving}
            className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add contact"}
          </button>
        </div>
      </div>
    </div>
  );
}
