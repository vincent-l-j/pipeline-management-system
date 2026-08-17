/**
 * Create an organisation without leaving the pitch form.
 *
 * Structurally a sibling of DeletePitchModal — same overlay, same outside-click
 * and Escape handling — because that is the only dialog precedent in the app.
 *
 * The owning page renders this as a sibling of its <form>, never nested inside
 * it: a form within a form is invalid, and the submit button here would
 * otherwise save the pitch.
 *
 * Only the fields that tell two similar organisations apart in a picker are
 * offered. Sector, ABN and notes belong on the Organisations page — asking for
 * them here would turn a two-second detour into a form.
 */

import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import { apiErrorMessage } from "../../services/apiError";
import type { Organisation } from "../../types";
import { ORG_TYPES, orgTypeLabel } from "./OrganisationConfig";

interface OrganisationQuickCreateModalProps {
  /** Pre-fills the name, so the text typed into the picker is not retyped. */
  initialName?: string;
  onCreated: (organisation: Organisation) => void;
  onCancel: () => void;
}

export default function OrganisationQuickCreateModal({
  initialName = "",
  onCreated,
  onCancel,
}: OrganisationQuickCreateModalProps): React.JSX.Element {
  const [name, setName] = useState(initialName);
  const [orgType, setOrgType] = useState("");
  const [stateTerritory, setStateTerritory] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel]);

  async function save(): Promise<void> {
    if (!name.trim()) {
      setError("A name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post<Organisation>("/organisations", {
        name: name.trim(),
        org_type: orgType || null,
        state_territory: stateTerritory.trim() || null,
        website: website.trim() || null,
      });
      onCreated(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to add organisation"));
      setSaving(false);
    }
  }

  const inputClass =
    "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300";
  const labelClass = "block text-sm font-medium text-navy-700 mb-1";

  return (
    <div
      data-testid="organisation-quick-create-overlay"
      onMouseDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onCancel();
      }}
      className="fixed inset-0 z-50 bg-navy-900/40 flex items-center justify-center p-4"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="organisation-quick-create-heading"
        className="bg-white rounded-xl border border-navy-100 shadow-lg w-full max-w-md p-6"
      >
        <h2
          id="organisation-quick-create-heading"
          className="text-lg font-semibold text-navy-900 mb-1"
        >
          Add organisation
        </h2>
        <p className="text-sm text-navy-500 mb-4">
          It will be selected on this pitch. You can fill in the rest on the
          Organisations page later.
        </p>

        <div className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="quick-org-name">
              Name *
            </label>
            <input
              id="quick-org-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="quick-org-type">
                Type
              </label>
              <select
                id="quick-org-type"
                value={orgType}
                onChange={(e) => {
                  setOrgType(e.target.value);
                }}
                className={inputClass}
              >
                <option value="">Select type...</option>
                {ORG_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {orgTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="quick-org-state">
                State/Territory
              </label>
              <input
                id="quick-org-state"
                type="text"
                value={stateTerritory}
                onChange={(e) => {
                  setStateTerritory(e.target.value);
                }}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="quick-org-website">
              Website
            </label>
            <input
              id="quick-org-website"
              type="text"
              value={website}
              onChange={(e) => {
                setWebsite(e.target.value);
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
            {saving ? "Adding..." : "Add organisation"}
          </button>
        </div>
      </div>
    </div>
  );
}
