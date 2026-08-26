/**
 * The pitch fields shared by the create and edit pages.
 *
 * Presentational and fully controlled: it fetches nothing, renders no `<form>`
 * element and no submit button. The owning page holds the state, decides what a
 * save means (POST vs PATCH) and renders any dialogs, which keeps stray-submit
 * and nested-form problems out of here.
 *
 * `onChange` takes a partial patch rather than a (field, value) pair because some
 * callers need to set several fields at once — selecting a newly created
 * organisation, for instance.
 */

import {
  DOMAIN_OPTIONS,
  SOURCE_OPTIONS,
  REQUEST_TYPE_OPTIONS,
  FUNDING_OPTIONS,
} from "../pipeline/PipelineConfig";
import Combobox from "../ui/Combobox";
import OptionSelect from "../ui/OptionSelect";
import ContactPicker from "../contacts/ContactPicker";
import { Contact, Organisation, User } from "../../types";
import { PitchFormValues } from "./pitchForm";
import { inputClass, labelClass } from "../ui/formStyles";

interface PitchFormFieldsProps {
  values: PitchFormValues;
  onChange: (patch: Partial<PitchFormValues>) => void;
  organisations: Organisation[];
  contacts: Contact[];
  users: User[];
  onCreateOrganisation?: (query: string) => void;
  onCreateContact?: (query: string) => void;
  organisationsError?: string | null;
  contactsError?: string | null;
  disabled?: boolean;
}

export default function PitchFormFields({
  values,
  onChange,
  organisations,
  contacts,
  users,
  onCreateOrganisation,
  onCreateContact,
  organisationsError,
  contactsError,
  disabled = false,
}: PitchFormFieldsProps): React.JSX.Element {
  function toggleDomain(domain: string): void {
    const selected = values.domain_tags;
    onChange({
      domain_tags: selected.includes(domain)
        ? selected.filter((d) => d !== domain)
        : [...selected, domain],
    });
  }

  return (
    <>
      <div>
        <label className={labelClass} htmlFor="pitch-title">
          Title *
        </label>
        <input
          id="pitch-title"
          type="text"
          required
          disabled={disabled}
          value={values.title}
          onChange={(e) => {
            onChange({ title: e.target.value });
          }}
          placeholder="e.g. AgriTech Soil Sensor Initiative"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="pitch-short-description">
          Short Description
        </label>
        <textarea
          id="pitch-short-description"
          rows={3}
          disabled={disabled}
          value={values.short_description}
          onChange={(e) => {
            onChange({ short_description: e.target.value });
          }}
          placeholder="A brief summary of the initiative (one or two sentences)..."
          className={inputClass}
        />
      </div>

      {/*
        One flat two-column grid rather than a row per pair, so the cells reflow
        on their own. `gap-y-5` matches the `space-y-5` the surrounding form uses
        between its other fields.
      */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <div>
          <label className={labelClass} htmlFor="pitch-submission-date">
            Submission Date
          </label>
          <input
            id="pitch-submission-date"
            type="date"
            disabled={disabled}
            value={values.submission_date}
            onChange={(e) => {
              onChange({ submission_date: e.target.value });
            }}
            className={inputClass}
          />
        </div>

        <OptionSelect
          id="pitch-source"
          label="Source"
          placeholder="Select source..."
          disabled={disabled}
          value={values.source}
          options={SOURCE_OPTIONS}
          onChange={(source) => {
            onChange({ source });
          }}
        />

        <OptionSelect
          id="pitch-request-type"
          label="Pitch Request"
          placeholder="Select request..."
          disabled={disabled}
          value={values.request_type}
          options={REQUEST_TYPE_OPTIONS}
          onChange={(request_type) => {
            onChange({ request_type });
          }}
        />

        <OptionSelect
          id="pitch-funding-pathway"
          label="Funding Pathway"
          placeholder="Select funding pathway..."
          disabled={disabled}
          value={values.funding_pathway}
          options={FUNDING_OPTIONS}
          onChange={(funding_pathway) => {
            onChange({ funding_pathway });
          }}
        />

        <div>
          <label className={labelClass} htmlFor="pitch-organisation">
            Organisation
          </label>
          <Combobox
            id="pitch-organisation"
            disabled={disabled}
            value={values.organisation_id}
            options={organisations.map((organisation) => ({
              value: organisation.id,
              label: organisation.name,
            }))}
            onChange={(organisation_id) => {
              onChange({ organisation_id });
            }}
            onCreate={onCreateOrganisation}
            createLabel={(query) =>
              query
                ? `Add "${query}" as a new organisation`
                : "Add a new organisation"
            }
            placeholder="Search organisations..."
          />
          {organisationsError && (
            <p className="text-xs text-red-600 mt-1">{organisationsError}</p>
          )}
        </div>

        <OptionSelect
          id="pitch-lead"
          label="Rozetta Lead"
          placeholder="Select lead..."
          disabled={disabled}
          value={values.lead_id}
          options={users.map((user) => ({
            value: user.id,
            label: user.display_name,
          }))}
          onChange={(lead_id) => {
            onChange({ lead_id });
          }}
        />
      </div>

      {/* Outside the two-column grid: the chips wrap, so a half-width cell
          would grow a row taller than everything beside it. */}
      <div>
        <span className={labelClass}>Contacts</span>
        <p className="text-xs text-navy-400 mb-2">
          The people behind this pitch
        </p>
        <ContactPicker
          id="pitch-contacts"
          disabled={disabled}
          contacts={contacts}
          value={values.contact_ids}
          onChange={(contact_ids) => {
            onChange({ contact_ids });
          }}
          onCreate={onCreateContact}
        />
        {contactsError && (
          <p className="text-xs text-red-600 mt-1">{contactsError}</p>
        )}
      </div>

      <div>
        <span className={labelClass}>Domains</span>
        <p className="text-xs text-navy-400 mb-2">Select all that apply</p>
        <div className="flex flex-wrap gap-2">
          {DOMAIN_OPTIONS.map((domain) => {
            const selected = values.domain_tags.includes(domain);
            return (
              <button
                key={domain}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => {
                  toggleDomain(domain);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-50 ${
                  selected
                    ? "bg-teal-100 text-teal-700 border-teal-300"
                    : "bg-white text-navy-500 border-navy-200 hover:border-navy-400"
                }`}
              >
                {domain}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="pitch-masterplan-alignment">
          Masterplan Alignment
        </label>
        <textarea
          id="pitch-masterplan-alignment"
          rows={2}
          disabled={disabled}
          value={values.masterplan_alignment}
          onChange={(e) => {
            onChange({ masterplan_alignment: e.target.value });
          }}
          placeholder="How does this align with Rozetta's strategic research agenda?"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="pitch-next-step">
          Next Step
        </label>
        <textarea
          id="pitch-next-step"
          rows={2}
          disabled={disabled}
          value={values.next_step}
          onChange={(e) => {
            onChange({ next_step: e.target.value });
          }}
          placeholder="The immediate next action, e.g. 'Call the CSIRO lead on Friday'"
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="is_confidential"
          disabled={disabled}
          checked={values.is_confidential}
          onChange={(e) => {
            onChange({ is_confidential: e.target.checked });
          }}
          className="w-4 h-4 rounded border-navy-300 text-navy-900 focus:ring-navy-300"
        />
        <label htmlFor="is_confidential" className="text-sm text-navy-700">
          Mark as confidential
        </label>
      </div>
    </>
  );
}
