/**
 * Pick any number of contacts, as chips plus a search box.
 *
 * The contact-side twin of OrganisationPicker, and the same shape for the same
 * reason: the people on a pitch are an unordered set with no primary, so this is
 * a set of chips rather than a ranked list. Chips sort by name so the same
 * selection always reads the same way.
 *
 * The search box is the shared Combobox pinned at value="": no option matches
 * "", so it renders empty, and each pick appends and leaves it empty again.
 * Already-picked people are filtered out of the options, so picking twice is
 * impossible rather than merely de-duplicated after the fact.
 */

import Combobox from "../ui/Combobox";
import { contactLabel, contactName } from "./contactName";
import type { Contact } from "../../types";

interface ContactPickerProps {
  /** Also the id the hidden label points at, so it must be unique on the page. */
  id: string;
  /** Every contact that can be picked. */
  contacts: Contact[];
  /** The picked contact ids. */
  value: string[];
  onChange: (contactIds: string[]) => void;
  /** Supplying this offers a row that creates a contact who is not on file. */
  onCreate?: (query: string) => void;
  /** Read-only: names stay visible, the controls go. */
  disabled?: boolean;
}

/** The picked contacts as objects, name-sorted; unknown ids are dropped. */
export function pickedContacts(
  contacts: Contact[],
  value: string[],
): Contact[] {
  return contacts
    .filter((contact) => value.includes(contact.id))
    .sort((a, b) => contactName(a).localeCompare(contactName(b)));
}

export default function ContactPicker({
  id,
  contacts,
  value,
  onChange,
  onCreate,
  disabled = false,
}: ContactPickerProps): React.JSX.Element {
  const picked = pickedContacts(contacts, value);
  const available = contacts.filter((contact) => !value.includes(contact.id));

  return (
    <div className="space-y-2">
      {picked.length === 0 ? (
        <p className="text-xs text-navy-400">No contacts</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {picked.map((contact) => (
            <li
              key={contact.id}
              data-testid="contact-chip"
              className="inline-flex items-center gap-1 bg-navy-50 text-navy-700 text-xs rounded-full pl-2.5 pr-1.5 py-1"
            >
              <span>{contactName(contact)}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${contactName(contact)}`}
                  onClick={() => {
                    onChange(value.filter((id) => id !== contact.id));
                  }}
                  className="text-navy-400 hover:text-navy-700 leading-none px-0.5"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <>
          <label className="sr-only" htmlFor={id}>
            Add contact
          </label>
          <Combobox
            id={id}
            options={available.map((contact) => ({
              value: contact.id,
              label: contactLabel(contact),
            }))}
            // Held at "" so the box never displays a "current" contact: there
            // isn't one, only a set.
            value=""
            onChange={(contactId) => {
              onChange([...value, contactId]);
            }}
            onCreate={onCreate}
            createLabel={(query) =>
              query ? `Add "${query}" as a new contact` : "Add a new contact"
            }
            placeholder="Search contacts..."
            className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </>
      )}
    </div>
  );
}
