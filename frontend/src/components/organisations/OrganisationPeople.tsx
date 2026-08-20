/**
 * The people at one organisation, shown in a row expanded beneath it.
 *
 * The other half of the affiliation picture: the Contacts page answers "which
 * organisations is this person at", and this answers "who is at this one".
 *
 * There is no organisation-side endpoint — affiliations live on the contact — so
 * adding and removing here both PATCH the contact with its new full set. The
 * updated contact is handed back to the page, which owns the list that every
 * organisation's count is derived from.
 *
 * Somebody who isn't on file yet can be created from the same picker. The
 * dialog is not rendered here: it belongs to the page, so that it opens outside
 * the table row this sits in and so the created contact lands in the one list
 * the page holds.
 */

import { useState } from "react";
import Combobox from "../ui/Combobox";
import { contactName } from "../contacts/contactName";
import api from "../../services/api";
import { apiErrorMessage } from "../../services/apiError";
import type { Contact, Organisation } from "../../types";

interface OrganisationPeopleProps {
  organisation: Organisation;
  /** Every contact, not just this organisation's — the picker needs the rest. */
  contacts: Contact[];
  /** Called with the contact as the API returned it after a link change. */
  onChanged: (contact: Contact) => void;
  /** Supplying this offers a row that creates a contact who is not on file.
   *  The dialog is the page's to render — see OrganisationsPage. */
  onCreate?: (query: string) => void;
  onError: (message: string) => void;
  canEdit: boolean;
}

/** Name first, email as the tie-breaker for the many similarly-named people. */
function pickerLabel(contact: Contact): string {
  const name = contactName(contact);
  return contact.email ? `${name} (${contact.email})` : name;
}

export function peopleAt(
  contacts: Contact[],
  organisationId: string,
): Contact[] {
  return contacts
    .filter((contact) => contact.organisation_ids.includes(organisationId))
    .sort((a, b) => contactName(a).localeCompare(contactName(b)));
}

export default function OrganisationPeople({
  organisation,
  contacts,
  onChanged,
  onCreate,
  onError,
  canEdit,
}: OrganisationPeopleProps): React.JSX.Element {
  const [saving, setSaving] = useState(false);

  const here = peopleAt(contacts, organisation.id);
  const elsewhere = contacts.filter(
    (contact) => !contact.organisation_ids.includes(organisation.id),
  );

  async function setAffiliations(
    contact: Contact,
    organisation_ids: string[],
  ): Promise<void> {
    setSaving(true);
    try {
      const { data } = await api.patch<Contact>(`/contacts/${contact.id}`, {
        organisation_ids,
      });
      onChanged(data);
    } catch (err) {
      onError(apiErrorMessage(err, "Failed to update affiliations"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {here.length === 0 ? (
        <p className="text-sm text-navy-400">No contacts here yet.</p>
      ) : (
        <ul className="divide-y divide-navy-50">
          {here.map((contact) => (
            <li
              key={contact.id}
              className="flex items-center justify-between py-2"
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm text-navy-800">
                  {contactName(contact)}
                </span>
                {contact.email && (
                  <span className="text-xs text-navy-400">{contact.email}</span>
                )}
              </span>
              {canEdit && (
                <button
                  type="button"
                  disabled={saving}
                  aria-label={`Remove ${contactName(contact)} from ${organisation.name}`}
                  onClick={() => {
                    void setAffiliations(
                      contact,
                      contact.organisation_ids.filter(
                        (id) => id !== organisation.id,
                      ),
                    );
                  }}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="max-w-sm">
          <label className="sr-only" htmlFor={`add-person-${organisation.id}`}>
            Add person
          </label>
          <Combobox
            id={`add-person-${organisation.id}`}
            options={elsewhere.map((contact) => ({
              value: contact.id,
              label: pickerLabel(contact),
            }))}
            // Held at "": this picks somebody to add, it has no current value.
            value=""
            onChange={(contactId) => {
              const contact = contacts.find((c) => c.id === contactId);
              if (!contact) return;
              void setAffiliations(contact, [
                ...contact.organisation_ids,
                organisation.id,
              ]);
            }}
            onCreate={onCreate}
            createLabel={(query) =>
              query ? `Add "${query}" as a new contact` : "Add a new contact"
            }
            disabled={saving}
            placeholder="Add a contact..."
            emptyMessage="Every contact is already here"
            className="w-full border border-navy-200 rounded-lg px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300 disabled:bg-navy-50"
          />
        </div>
      )}
    </div>
  );
}
