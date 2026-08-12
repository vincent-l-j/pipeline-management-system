import { useState, useEffect, ChangeEvent } from "react";
import { AxiosError } from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const inputClass =
  "w-full border border-navy-200 rounded-lg px-3 py-1.5 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300";

interface Contact {
  id: number;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string | null;
  last_contacted: string | null;
}

interface ContactForm {
  first_name: string;
  last_name: string;
  role: string;
  email: string;
}

const EMPTY_FORM: ContactForm = {
  first_name: "",
  last_name: "",
  role: "",
  email: "",
};

const EDITABLE_FIELDS: (keyof ContactForm)[] = [
  "first_name",
  "last_name",
  "role",
  "email",
];

/** Both name parts are optional, but a contact with neither is unidentifiable. */
function hasName(form: ContactForm): boolean {
  return Boolean(form.first_name.trim() || form.last_name.trim());
}

interface ErrorResponse {
  detail?: string;
}

export default function ContactsPage(): React.JSX.Element {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ContactForm>(EMPTY_FORM);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
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
  }, []);

  const addContact = async (): Promise<void> => {
    if (!hasName(form)) return;
    setError("");
    try {
      const { data } = await api.post<Contact>("/contacts", {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        role: form.role.trim() || null,
        email: form.email.trim() || null,
      });
      setContacts((prev) => [...prev, data]);
      setForm(EMPTY_FORM);
      setShowAdd(false);
    } catch (err) {
      const apiError = err as AxiosError<ErrorResponse>;
      setError(apiError.response?.data.detail ?? "Failed to add contact");
    }
  };

  const startEdit = (contact: Contact): void => {
    setError("");
    setEditingId(contact.id);
    setEditForm({
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      role: contact.role ?? "",
      email: contact.email ?? "",
    });
  };

  const cancelEdit = (): void => {
    setEditingId(null);
  };

  const saveEdit = async (contact: Contact): Promise<void> => {
    const changes: Record<string, string | null> = {};
    for (const field of EDITABLE_FIELDS) {
      const next = editForm[field].trim() || null;
      if (next !== (contact[field] ?? null)) changes[field] = next;
    }
    if (!hasName(editForm) || Object.keys(changes).length === 0) {
      setEditingId(null);
      return;
    }
    setError("");
    try {
      const { data } = await api.patch<Contact>(
        `/contacts/${String(contact.id)}`,
        changes,
      );
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? data : c)));
      setEditingId(null);
    } catch (err) {
      const apiError = err as AxiosError<ErrorResponse>;
      setError(apiError.response?.data.detail ?? "Failed to update contact");
    }
  };

  const removeContact = async (id: number): Promise<void> => {
    setError("");
    try {
      await api.delete(`/contacts/${String(id)}`);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      const apiError = err as AxiosError<ErrorResponse>;
      setError(apiError.response?.data.detail ?? "Failed to remove contact");
    } finally {
      setConfirmingId(null);
    }
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
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={form.role}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setForm((p) => ({ ...p, role: e.target.value }));
              }}
              placeholder="Role (optional)"
              className={inputClass}
            />
            <input
              type="email"
              value={form.email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setForm((p) => ({ ...p, email: e.target.value }));
              }}
              placeholder="Email (optional)"
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                void addContact();
              }}
              disabled={!hasName(form)}
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
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  First Name
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Last Name
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Role
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">
                  Last Contacted
                </th>
                {(canEdit || canRemove) && (
                  <th className="text-right px-4 py-3 font-semibold text-navy-700">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {contacts.map((c) =>
                editingId === c.id ? (
                  <tr key={c.id} className="bg-navy-50/50">
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={editForm.role}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          setEditForm((p) => ({ ...p, role: e.target.value }));
                        }}
                        aria-label="Contact role"
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-navy-500">
                      {c.last_contacted ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex gap-2">
                        <button
                          onClick={() => {
                            void saveEdit(c);
                          }}
                          disabled={!hasName(editForm)}
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
                    <td className="px-4 py-3 text-navy-500">{c.role ?? "-"}</td>
                    <td className="px-4 py-3 text-navy-500">
                      {c.email ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-navy-500">
                      {c.last_contacted ?? "-"}
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
    </Layout>
  );
}
