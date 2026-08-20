/**
 * Edit an existing pitch. Renders the same PitchFormFields as the create page,
 * pre-filled from the pitch, and submits a PATCH on save. Pipeline stage is
 * intentionally NOT editable here — stage changes go through the Kanban board so
 * every transition is audited. Viewers are redirected back to the detail page.
 */

import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import PitchFormFields from "../components/pitch/PitchFormFields";
import OrganisationQuickCreateModal from "../components/organisations/OrganisationQuickCreateModal";
import ContactQuickCreateModal from "../components/contacts/ContactQuickCreateModal";
import {
  EMPTY_PITCH_FORM,
  pitchFormFromApi,
  pitchPayload,
  PitchFormSource,
  PitchFormValues,
} from "../components/pitch/pitchForm";
import api from "../services/api";
import { apiErrorMessage } from "../services/apiError";
import { useAuth } from "../contexts/AuthContext";
import { Contact, User, Organisation } from "../types";

export default function PitchEditPage(): React.JSX.Element {
  const { pitchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "assessor";

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [creatingOrgFrom, setCreatingOrgFrom] = useState<string | null>(null);
  const [creatingContactFrom, setCreatingContactFrom] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<PitchFormValues>(EMPTY_PITCH_FORM);

  useEffect(() => {
    if (!canEdit || !pitchId) return;
    Promise.all([
      api.get<PitchFormSource>(`/pitches/${pitchId}`),
      api.get<Organisation[]>("/organisations"),
      api.get<Contact[]>("/contacts"),
      api.get<User[]>("/users/directory"),
    ])
      .then(([pitchRes, orgsRes, contactsRes, usersRes]) => {
        setForm(pitchFormFromApi(pitchRes.data));
        setOrganisations(orgsRes.data);
        setContacts(contactsRes.data);
        setUsers(usersRes.data);
        setLoading(false);
      })
      .catch(() => {
        void navigate(`/pitches/${pitchId}`);
      });
  }, [pitchId, canEdit, navigate]);

  function update(patch: Partial<PitchFormValues>): void {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function organisationCreated(organisation: Organisation): void {
    setOrganisations((prev) => [...prev, organisation]);
    update({ organisation_id: organisation.id });
    setCreatingOrgFrom(null);
  }

  /** A newly created contact joins the picker's list and this pitch. Appended
   *  through the setter, not a patch built from `form`, so it cannot drop a
   *  contact picked in the same render. */
  function contactCreated(contact: Contact): void {
    setContacts((prev) => [...prev, contact]);
    setForm((prev) => ({
      ...prev,
      contact_ids: [...prev.contact_ids, contact.id],
    }));
    setCreatingContactFrom(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!pitchId) return;
    // See PitchCreatePage: never save the pitch behind an open dialog.
    if (creatingOrgFrom !== null || creatingContactFrom !== null) return;
    setSaving(true);
    setError(null);

    try {
      await api.patch(`/pitches/${pitchId}`, pitchPayload(form));
      void navigate(`/pitches/${pitchId}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save pitch"));
      setSaving(false);
    }
  }

  if (!pitchId) return <Navigate to="/pitches" replace />;
  if (!canEdit) return <Navigate to={`/pitches/${pitchId}`} replace />;

  if (loading) {
    return (
      <Layout>
        <p className="text-navy-400">Loading pitch...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Edit Pitch"
        description="Update the initiative's details"
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

        <PitchFormFields
          values={form}
          onChange={update}
          organisations={organisations}
          contacts={contacts}
          users={users}
          onCreateOrganisation={(query) => {
            setCreatingOrgFrom(query);
          }}
          onCreateContact={(query) => {
            setCreatingContactFrom(query);
          }}
        />

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-navy-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (pitchId) void navigate(`/pitches/${pitchId}`);
            }}
            className="border border-navy-200 text-navy-600 px-6 py-2.5 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Siblings of the form, never nested inside it — see PitchCreatePage. */}
      {creatingOrgFrom !== null && (
        <OrganisationQuickCreateModal
          initialName={creatingOrgFrom}
          onCreated={organisationCreated}
          onCancel={() => {
            setCreatingOrgFrom(null);
          }}
        />
      )}

      {creatingContactFrom !== null && (
        <ContactQuickCreateModal
          initialQuery={creatingContactFrom}
          onCreated={contactCreated}
          onCancel={() => {
            setCreatingContactFrom(null);
          }}
        />
      )}
    </Layout>
  );
}
