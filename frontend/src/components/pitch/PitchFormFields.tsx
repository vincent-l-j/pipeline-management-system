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
  FUNDING_OPTIONS,
} from "../pipeline/PipelineConfig";
import { Organisation, User } from "../../types";
import { PitchFormValues } from "./pitchForm";
import { inputClass, labelClass } from "./formStyles";

interface PitchFormFieldsProps {
  values: PitchFormValues;
  onChange: (patch: Partial<PitchFormValues>) => void;
  organisations: Organisation[];
  users: User[];
  disabled?: boolean;
}

export default function PitchFormFields({
  values,
  onChange,
  organisations,
  users,
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

        <div>
          <label className={labelClass} htmlFor="pitch-source">
            Source
          </label>
          <select
            id="pitch-source"
            disabled={disabled}
            value={values.source}
            onChange={(e) => {
              onChange({ source: e.target.value });
            }}
            className={inputClass}
          >
            <option value="">Select source...</option>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="pitch-funding-pathway">
            Funding Pathway
          </label>
          <select
            id="pitch-funding-pathway"
            disabled={disabled}
            value={values.funding_pathway}
            onChange={(e) => {
              onChange({ funding_pathway: e.target.value });
            }}
            className={inputClass}
          >
            <option value="">Select funding pathway...</option>
            {FUNDING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="pitch-organisation">
            Organisation
          </label>
          <select
            id="pitch-organisation"
            disabled={disabled}
            value={values.organisation_id}
            onChange={(e) => {
              onChange({ organisation_id: e.target.value });
            }}
            className={inputClass}
          >
            <option value="">Select organisation...</option>
            {organisations.map((organisation) => (
              <option key={organisation.id} value={organisation.id}>
                {organisation.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="pitch-lead">
            Rozetta Lead
          </label>
          <select
            id="pitch-lead"
            disabled={disabled}
            value={values.lead_id}
            onChange={(e) => {
              onChange({ lead_id: e.target.value });
            }}
            className={inputClass}
          >
            <option value="">Select lead...</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name}
              </option>
            ))}
          </select>
        </div>
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
