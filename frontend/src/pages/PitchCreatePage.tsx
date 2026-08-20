/**
 * Create a new pitch in the pipeline.
 * The fields themselves live in PitchFormFields, shared with the edit page; this
 * page owns the state, the lookups it needs to populate the pickers, and the POST.
 */

import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import PitchFormFields from "../components/pitch/PitchFormFields";
import OrganisationQuickCreateModal from "../components/organisations/OrganisationQuickCreateModal";
import {
  newPitchForm,
  pitchPayload,
  PitchFormValues,
} from "../components/pitch/pitchForm";
import api from "../services/api";
import { apiErrorMessage } from "../services/apiError";
import { useAuth } from "../contexts/AuthContext";
import { Contact, User, Organisation } from "../types";

interface PitchResponse {
  id: string;
}

export default function PitchCreatePage(): React.JSX.Element {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreateOrganisation =
    user?.role === "admin" || user?.role === "assessor";

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [organisationsError, setOrganisationsError] = useState<string | null>(
    null,
  );
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [creatingOrgFrom, setCreatingOrgFrom] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<PitchFormValues>(newPitchForm);

  useEffect((): void => {
    api
      .get<Organisation[]>("/organisations")
      .then(({ data }) => {
        setOrganisations(data);
      })
      .catch((err: unknown): void => {
        setOrganisationsError(
          apiErrorMessage(err, "Could not load organisations"),
        );
      });
    api
      .get<Contact[]>("/contacts")
      .then(({ data }) => {
        setContacts(data);
      })
      .catch((err: unknown): void => {
        setContactsError(apiErrorMessage(err, "Could not load contacts"));
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

  const update = (patch: Partial<PitchFormValues>): void => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const organisationCreated = (organisation: Organisation): void => {
    setOrganisations((prev) => [...prev, organisation]);
    update({ organisation_id: organisation.id });
    setCreatingOrgFrom(null);
    setOrganisationsError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { data } = await api.post<PitchResponse>(
        "/pitches",
        pitchPayload(form),
      );
      void navigate(`/pitches/${data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create pitch"));
      setSaving(false);
    }
  };

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

        <PitchFormFields
          values={form}
          onChange={update}
          organisations={organisations}
          contacts={contacts}
          users={users}
          organisationsError={organisationsError}
          contactsError={contactsError}
          onCreateOrganisation={
            canCreateOrganisation
              ? (query) => {
                  setCreatingOrgFrom(query);
                }
              : undefined
          }
        />

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

      {/*
        A sibling of the form, never nested inside it: a nested form is invalid
        HTML and this dialog's buttons would submit the pitch.
      */}
      {creatingOrgFrom !== null && (
        <OrganisationQuickCreateModal
          initialName={creatingOrgFrom}
          onCreated={organisationCreated}
          onCancel={() => {
            setCreatingOrgFrom(null);
          }}
        />
      )}
    </Layout>
  );
}
