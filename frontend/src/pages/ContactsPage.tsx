/**
 * The contact directory.
 *
 * Organisations are the column that makes this page useful: a contact may be
 * affiliated with any number of them, and until they are on screen there is no
 * way to tell a consultant working across three companies from a lone founder.
 * They are loaded separately and joined by id here, so the page holds one
 * organisation list that serves both the column and the pickers.
 */

import { useState, useEffect, ChangeEvent } from "react";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import OrganisationPicker, {
  pickedOrganisations,
} from "../components/contacts/OrganisationPicker";
import OrganisationQuickCreateModal from "../components/organisations/OrganisationQuickCreateModal";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import { apiErrorMessage } from "../services/apiError";
import type { Contact, Organisation } from "../types";

const inputClass =
  "w-full border border-navy-200 rounded-lg px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300";

interface ContactForm {
  first_name: string;
  last_name: string;
  email: string;
  organisation_ids: string[];
}

const EMPTY_FORM: ContactForm = {
  first_name: "",
  last_name: "",
  email: "",
  organisation_ids: [],
};

const EDITABLE_FIELDS: ("first_name" | "last_name" | "email")[] = [
  "first_name",
  "last_name",
  "email",
];

/** Every field is optional, but a contact with nothing recorded is not a contact
 *  — the API refuses one, so don't offer to submit it. An organisation counts:
 *  "someone at Acme" is a contact worth keeping. */
function hasAnyDetail(form: ContactForm): boolean {
  return (
    EDITABLE_FIELDS.some((field) => form[field].trim() !== "") ||
    form.organisation_ids.length > 0
  );
}

/** Affiliations are a set, so a reorder is not a change worth PATCHing. */
function sameOrganisations(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Which form a quick-created organisation should be added to. */
interface CreateTarget {
  form: "add" | "edit";
  query: string;
}

export default function ContactsPage(): React.JSX.Element {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ContactForm>(EMPTY_FORM);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [creating, setCreating] = useState<CreateTarget | null>(null);
  const [error, setError] = useState("");

  const canAdd = user?.role === "admin" || user?.role === "assessor";
  const canEdit = user?.role === "admin" || user?.role === "assessor";
  const canRemove = user?.role === "admin";

  useEffect((): void => {
    api
      .get<Contact[]>("/contacts")
      .then(({ data }) => {
        setContacts(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
    api
      .get<Organisation[]>("/organisations")
      .then(({ data }) => {
        setOrganisations(data);
      })
      .catch(() => {
        // The column simply stays empty; contacts are still usable.
      });
  }, []);

  const organisationNames = (contact: Contact): string =>
    pickedOrganisations(organisations, contact.organisation_ids)
      .map((organisation) => organisation.name)
      .join(", ");

  const addContact = async (): Promise<void> => {
    if (!hasAnyDetail(form)) return;
    setError("");
    try {
      const { data } = await api.post<Contact>("/contacts", {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        organisation_ids: form.organisation_ids,
      });
      setContacts((prev) => [...prev, data]);
      setForm(EMPTY_FORM);
      setShowAdd(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to add contact"));
    }
  };

  const startEdit = (contact: Contact): void => {
    setError("");
    setEditingId(contact.id);
    setEditForm({
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      email: contact.email ?? "",
      organisation_ids: contact.organisation_ids,
    });
  };

  const cancelEdit = (): void => {
    setEditingId(null);
  };

  const saveEdit = async (contact: Contact): Promise<void> => {
    const changes: Record<string, string | string[] | null> = {};
    for (const field of EDITABLE_FIELDS) {
      const next = editForm[field].trim() || null;
      if (next !== (contact[field] ?? null)) changes[field] = next;
    }
    if (
      !sameOrganisations(editForm.organisation_ids, contact.organisation_ids)
    ) {
      changes.organisation_ids = editForm.organisation_ids;
    }
    if (!hasAnyDetail(editForm) || Object.keys(changes).length === 0) {
      setEditingId(null);
      return;
    }
    setError("");
    try {
      const { data } = await api.patch<Contact>(
        `/contacts/${contact.id}`,
        changes,
      );
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? data : c)));
      setEditingId(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update contact"));
    }
  };

  const removeContact = async (id: string): Promise<void> => {
    setError("");
    try {
      await api.delete(`/contacts/${id}`);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to remove contact"));
    } finally {
      setConfirmingId(null);
    }
  };

  /** A newly created organisation joins the list and the form that asked for it. */
  const organisationCreated = (organisation: Organisation): void => {
    setOrganisations((prev) => [...prev, organisation]);
    const select = (prev: ContactForm): ContactForm => ({
      ...prev,
      organisation_ids: [...prev.organisation_ids, organisation.id],
    });
    if (creating?.form === "edit") setEditForm(select);
    else setForm(select);
    setCreating(null);
  };

  return (
    <Layout>
      <PageHeader
        title="Contacts"
        description="External contacts linked to pitches and meetings"
        action={
          canAdd && (
            <button
              onClick={() => {
                setShowAdd((s) => !s);
                setError("");
              }}
              className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
            >
              + Add Contact
            </button>
          )
        }
      />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {showAdd && canAdd && (
        <div className="mb-4 p-4 bg-navy-50 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={form.first_name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setForm((p) => ({ ...p, first_name: e.target.value }));
              }}
              placeholder="First name"
              className={inputClass}
            />
            <input
              type="text"
              value={form.last_name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setForm((p) => ({ ...p, last_name: e.target.value }));
              }}
              placeholder="Last name"
              className={inputClass}
            />
          </div>
          <input
            type="email"
            value={form.email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setForm((p) => ({ ...p, email: e.target.value }));
            }}
            placeholder="Email"
            className={inputClass}
          />
          <OrganisationPicker
            id="add-contact-organisations"
            organisations={organisations}
            value={form.organisation_ids}
            onChange={(organisation_ids) => {
              setForm((p) => ({ ...p, organisation_ids }));
            }}
            onCreate={(query) => {
              setCreating({ form: "add", query });
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                void addContact();
              }}
              disabled={!hasAnyDetail(form)}
              className="text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setForm(EMPTY_FORM);
              }}
              className="text-xs border border-navy-200 text-navy-600 px-3 py-1.5 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-navy-400">Loading...</p>
      ) : contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy-100 p-8 text-center">
          <p className="text-navy-500">No contacts yet.</p>
        </div>
      ) : (
        // Deliberately not overflow-hidden: the organisation picker's dropdown
        // opens out of an editing row and would be clipped by it.
        <div className="bg-white rounded-xl border border-navy-100">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700 rounded-tl-xl">
                  First Name
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Last Name
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Email
                </th>
                <th
                  className={`text-left px-4 py-3 font-semibold text-navy-700 ${
                    canEdit || canRemove ? "" : "rounded-tr-xl"
                  }`}
                >
                  Organisations
                </th>
                {(canEdit || canRemove) && (
                  <th className="text-right px-4 py-3 font-semibold text-navy-700 rounded-tr-xl">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {contacts.map((c) =>
                editingId === c.id ? (
                  <tr key={c.id} className="bg-navy-50/50">
                    <td className="px-4 py-3 align-top">
                      <input
                        type="text"
                        value={editForm.first_name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          setEditForm((p) => ({
                            ...p,
                            first_name: e.target.value,
                          }));
                        }}
                        aria-label="Contact first name"
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="text"
                        value={editForm.last_name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          setEditForm((p) => ({
                            ...p,
                            last_name: e.target.value,
                          }));
                        }}
                        aria-label="Contact last name"
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          setEditForm((p) => ({ ...p, email: e.target.value }));
                        }}
                        aria-label="Contact email"
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <OrganisationPicker
                        id="edit-contact-organisations"
                        organisations={organisations}
                        value={editForm.organisation_ids}
                        onChange={(organisation_ids) => {
                          setEditForm((p) => ({ ...p, organisation_ids }));
                        }}
                        onCreate={(query) => {
                          setCreating({ form: "edit", query });
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <span className="inline-flex gap-2">
                        <button
                          onClick={() => {
                            void saveEdit(c);
                          }}
                          disabled={!hasAnyDetail(editForm)}
                          className="text-xs bg-navy-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs border border-navy-200 text-navy-600 px-3 py-1.5 rounded-lg"
                        >
                          Cancel
                        </button>
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={c.id}
                    className="hover:bg-navy-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-navy-900">
                      {c.first_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-navy-900">
                      {c.last_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-navy-500">
                      {c.email ?? "-"}
                    </td>
                    <td
                      className="px-4 py-3 text-navy-500 max-w-xs truncate"
                      title={organisationNames(c)}
                    >
                      {organisationNames(c) || "-"}
                    </td>
                    {(canEdit || canRemove) && (
                      <td className="px-4 py-3 text-right">
                        {confirmingId === c.id ? (
                          <span className="inline-flex gap-2">
                            <button
                              onClick={() => {
                                void removeContact(c.id);
                              }}
                              className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => {
                                setConfirmingId(null);
                              }}
                              className="text-xs text-navy-500 hover:text-navy-700"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-3">
                            {canEdit && (
                              <button
                                onClick={() => {
                                  startEdit(c);
                                }}
                                className="text-xs text-navy-600 hover:text-navy-900"
                              >
                                Edit
                              </button>
                            )}
                            {canRemove && (
                              <button
                                onClick={() => {
                                  setConfirmingId(c.id);
                                  setError("");
                                }}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {creating !== null && (
        <OrganisationQuickCreateModal
          initialName={creating.query}
          onCreated={organisationCreated}
          onCancel={() => {
            setCreating(null);
          }}
        />
      )}
    </Layout>
  );
}
