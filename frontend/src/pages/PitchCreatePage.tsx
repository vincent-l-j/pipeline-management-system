/**
 * Create a new pitch in the pipeline.
 * Form captures title, description, source, funding pathway,
 * domain tags, organisation, lead, and confidentiality flag.
 */

import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { DOMAIN_OPTIONS } from "../components/pipeline/PipelineConfig";
import api from "../services/api";
import { User, Organisation } from "../types";

interface SelectOption {
  value: string;
  label: string;
}

const SOURCES: SelectOption[] = [
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "event", label: "Event" },
  { value: "cold_outreach", label: "Cold Outreach" },
  { value: "internal", label: "Internal" },
  { value: "riac", label: "RIAC" },
  { value: "foundry", label: "Foundry" },
  { value: "board", label: "Board" },
  { value: "riac_student", label: "RIAC Student" },
  { value: "rozetta_network", label: "Rozetta Network" },
];

const FUNDING_PATHWAYS: SelectOption[] = [
  { value: "crc_bid", label: "CRC Bid" },
  { value: "rdti", label: "RDTI" },
  { value: "philanthropic", label: "Philanthropic" },
  { value: "government_grant", label: "Government Grant" },
  { value: "private", label: "Private" },
  { value: "other", label: "Other" },
  { value: "no_funding_identified", label: "No Funding Identified" },
  { value: "internal_funding", label: "Internal Funding" },
];

interface PitchForm {
  title: string;
  short_description: string;
  submission_date: string;
  source: string;
  funding_pathway: string;
  domain_tags: string[];
  masterplan_alignment: string;
  is_confidential: boolean;
  organisation_id: string;
  lead_id: string;
}

interface PitchResponse {
  id: string;
}

export default function PitchCreatePage(): React.JSX.Element {
  const navigate = useNavigate();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<PitchForm>({
    title: "",
    short_description: "",
    submission_date: new Date().toISOString().split("T")[0],
    source: "",
    funding_pathway: "",
    domain_tags: [],
    masterplan_alignment: "",
    is_confidential: false,
    organisation_id: "",
    lead_id: "",
  });

  useEffect((): void => {
    api
      .get<Organisation[]>("/organisations")
      .then(({ data }) => {
        setOrganisations(data);
      })
      .catch((): void => {
        /* silently handle error */
      });
    api
      .get<User[]>("/users/directory")
      .then(({ data }) => {
        setUsers(data);
      })
      .catch((): void => {
        /* silently handle error */
      });
  }, []);

  const update = (field: keyof PitchForm, value: string | boolean): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDomain = (domain: string): void => {
    setForm((prev) => {
      const current = prev.domain_tags;
      const next = current.includes(domain)
        ? current.filter((d) => d !== domain)
        : [...current, domain];
      return { ...prev, domain_tags: next };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title,
      short_description: form.short_description || null,
      submission_date: form.submission_date || null,
      source: form.source || null,
      funding_pathway: form.funding_pathway || null,
      domain_tags:
        form.domain_tags.length > 0 ? form.domain_tags.join(",") : null,
      masterplan_alignment: form.masterplan_alignment || null,
      is_confidential: form.is_confidential,
      organisation_id: form.organisation_id || null,
      lead_id: form.lead_id || null,
    };

    try {
      const { data } = await api.post<PitchResponse>("/pitches", payload);
      void navigate(`/pitches/${data.id}`);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data.detail ?? "Failed to create pitch");
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300";
  const labelClass = "block text-sm font-medium text-navy-700 mb-1";

  return (
    <Layout>
      <PageHeader
        title="New Pitch"
        description="Add a new initiative to the pipeline"
      />

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="max-w-2xl space-y-5"
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label className={labelClass}>Title *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => {
              update("title", e.target.value);
            }}
            placeholder="e.g. AgriTech Soil Sensor Initiative"
            className={inputClass}
          />
        </div>

        {/* Short Description */}
        <div>
          <label className={labelClass}>Short Description</label>
          <textarea
            rows={3}
            value={form.short_description}
            onChange={(e) => {
              update("short_description", e.target.value);
            }}
            placeholder="A brief summary of the initiative (one or two sentences)..."
            className={inputClass}
          />
        </div>

        {/* Submission Date and Source — row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Submission Date</label>
            <input
              type="date"
              value={form.submission_date}
              onChange={(e) => {
                update("submission_date", e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Source</label>
            <select
              value={form.source}
              onChange={(e) => {
                update("source", e.target.value);
              }}
              className={inputClass}
            >
              <option value="">Select source...</option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Funding Pathway and Organisation — row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Funding Pathway</label>
            <select
              value={form.funding_pathway}
              onChange={(e) => {
                update("funding_pathway", e.target.value);
              }}
              className={inputClass}
            >
              <option value="">Select funding pathway...</option>
              {FUNDING_PATHWAYS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Organisation</label>
            <select
              value={form.organisation_id}
              onChange={(e) => {
                update("organisation_id", e.target.value);
              }}
              className={inputClass}
            >
              <option value="">Select organisation...</option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rozetta Lead */}
        <div>
          <label className={labelClass}>Rozetta Lead</label>
          <select
            value={form.lead_id}
            onChange={(e) => {
              update("lead_id", e.target.value);
            }}
            className={inputClass}
          >
            <option value="">Select lead...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </div>

        {/* Domain Tags */}
        <div>
          <label className={labelClass}>Domains</label>
          <p className="text-xs text-navy-400 mb-2">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_OPTIONS.map((domain) => (
              <button
                key={domain}
                type="button"
                onClick={() => {
                  toggleDomain(domain);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  form.domain_tags.includes(domain)
                    ? "bg-teal-100 text-teal-700 border-teal-300"
                    : "bg-white text-navy-500 border-navy-200 hover:border-navy-400"
                }`}
              >
                {domain.charAt(0).toUpperCase() + domain.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Masterplan Alignment */}
        <div>
          <label className={labelClass}>Masterplan Alignment</label>
          <textarea
            rows={2}
            value={form.masterplan_alignment}
            onChange={(e) => {
              update("masterplan_alignment", e.target.value);
            }}
            placeholder="How does this align with Rozetta's strategic research agenda?"
            className={inputClass}
          />
        </div>

        {/* Confidential */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_confidential"
            checked={form.is_confidential}
            onChange={(e) => {
              update("is_confidential", e.target.checked);
            }}
            className="w-4 h-4 rounded border-navy-300 text-navy-900 focus:ring-navy-300"
          />
          <label htmlFor="is_confidential" className="text-sm text-navy-700">
            Mark as confidential
          </label>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-navy-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Pitch"}
          </button>
          <button
            type="button"
            onClick={() => {
              void navigate("/pitches");
            }}
            className="border border-navy-200 text-navy-600 px-6 py-2.5 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  );
}
