/**
 * Pick any number of organisations for a contact.
 *
 * Affiliations are unordered and equal — there is no primary — so this is a set
 * of chips plus a search box, not a ranked list. Chips sort by name so the same
 * selection always reads the same way.
 *
 * The search box is the shared Combobox pinned at value="": no option matches
 * "", so it renders empty, and each pick appends and leaves it empty again.
 * That is what makes repeated picking feel like adding rather than replacing,
 * and it needs no change to Combobox itself. Already-picked organisations are
 * filtered out of the options, so picking twice is impossible rather than merely
 * de-duplicated after the fact.
 */

import Combobox from "../ui/Combobox";
import type { Organisation } from "../../types";

interface OrganisationPickerProps {
  /** Also the id the hidden label points at, so it must be unique on the page. */
  id: string;
  /** Every organisation that can be picked. */
  organisations: Organisation[];
  /** The picked organisation ids. */
  value: string[];
  onChange: (organisationIds: string[]) => void;
  /** Supplying this offers a row that creates a missing organisation. */
  onCreate?: (query: string) => void;
  /** Read-only: names stay visible, the controls go. */
  disabled?: boolean;
}

/** The picked organisations as objects, name-sorted; unknown ids are dropped. */
export function pickedOrganisations(
  organisations: Organisation[],
  value: string[],
): Organisation[] {
  return organisations
    .filter((organisation) => value.includes(organisation.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function OrganisationPicker({
  id,
  organisations,
  value,
  onChange,
  onCreate,
  disabled = false,
}: OrganisationPickerProps): React.JSX.Element {
  const picked = pickedOrganisations(organisations, value);
  const available = organisations.filter(
    (organisation) => !value.includes(organisation.id),
  );

  return (
    <div className="space-y-2">
      {picked.length === 0 ? (
        <p className="text-xs text-navy-400">No organisations</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {picked.map((organisation) => (
            <li
              key={organisation.id}
              data-testid="organisation-chip"
              className="inline-flex items-center gap-1 bg-navy-50 text-navy-700 text-xs rounded-full pl-2.5 pr-1.5 py-1"
            >
              <span>{organisation.name}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${organisation.name}`}
                  onClick={() => {
                    onChange(value.filter((id) => id !== organisation.id));
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
            Add organisation
          </label>
          <Combobox
            id={id}
            options={available.map((organisation) => ({
              value: organisation.id,
              label: organisation.name,
            }))}
            // Held at "" so the box never displays a "current" organisation:
            // there isn't one, only a set.
            value=""
            onChange={(organisationId) => {
              onChange([...value, organisationId]);
            }}
            onCreate={onCreate}
            createLabel={(query) =>
              query ? `Add "${query}"` : "Add a new organisation"
            }
            placeholder="Search organisations..."
            className="w-full border border-navy-200 rounded-lg px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </>
      )}
    </div>
  );
}
