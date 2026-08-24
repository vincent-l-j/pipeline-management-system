/** Pitch detail page — the single view for everything about a pitch. */

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { AxiosResponse } from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import ActivityTimeline from "../components/pitch/ActivityTimeline";
import DeletePitchModal from "../components/pitch/DeletePitchModal";
import FileLinks from "../components/pitch/FileLinks";
import AddPitchContactsModal from "../components/pitch/AddPitchContactsModal";
import { pickedContacts } from "../components/contacts/ContactPicker";
import { contactName } from "../components/contacts/contactName";
import {
  STAGE_MAP,
  SOURCE_LABELS,
  FUNDING_LABELS,
} from "../components/pipeline/PipelineConfig";
import { DECLINE_REASON_LABELS } from "../components/assessments/AssessmentConfig";
import api from "../services/api";
import { apiErrorMessage } from "../services/apiError";
import { useAuth } from "../contexts/AuthContext";
import type { Assessment, Contact, Pitch, User, Organisation } from "../types";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
}

interface ExtendedPitch extends Pitch {
  organisation_id?: string;
  is_confidential?: boolean;
  masterplan_alignment?: string;
  contact_ids?: string[];
  next_step?: string | null;
}

export default function PitchDetailPage(): React.JSX.Element {
  const { pitchId } = useParams<{ pitchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pitch, setPitch] = useState<ExtendedPitch | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [org, setOrg] = useState<Organisation | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [addingContacts, setAddingContacts] = useState<boolean>(false);
  const [removingContact, setRemovingContact] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>("");

  const canEdit: boolean = user?.role === "admin" || user?.role === "assessor";
  // UX only — the server enforces admin on DELETE /api/pitches/{id}.
  const canDelete: boolean = user?.role === "admin";

  useEffect((): void => {
    if (!pitchId) {
      void navigate("/pitches");
      return;
    }
    Promise.all([
      api.get<ExtendedPitch>(`/pitches/${pitchId}`),
      api.get<User[]>("/users/directory"),
    ])
      .then(
        ([pitchRes, usersRes]): Promise<
          [
            AxiosResponse<Meeting[]>,
            AxiosResponse<Assessment[]>,
            AxiosResponse<Organisation> | undefined,
          ]
        > => {
          const p = pitchRes.data;
          setPitch(p);
          setUsers(usersRes.data);

          const promises: Promise<
            AxiosResponse<Meeting[] | Assessment[] | Organisation>
          >[] = [
            api.get<Meeting[]>(`/meetings?pitch_id=${pitchId}`),
            api.get<Assessment[]>(`/pitches/${pitchId}/assessments`),
          ];
          if (p.organisation_id) {
            promises.push(
              api.get<Organisation>(`/organisations/${p.organisation_id}`),
            );
          }
          return Promise.all(promises) as Promise<
            [
              AxiosResponse<Meeting[]>,
              AxiosResponse<Assessment[]>,
              AxiosResponse<Organisation> | undefined,
            ]
          >;
        },
      )
      .then(([meetingsRes, assessmentsRes, orgRes]): void => {
        setMeetings(meetingsRes.data);
        setAssessments(assessmentsRes.data);
        if (orgRes) setOrg(orgRes.data);
        setLoading(false);
      })
      .catch((): void => {
        void navigate("/pitches");
      });

    // Off the main chain: a failed directory lookup becomes a note in one card
    // rather than a redirect away from a pitch that is still worth reading.
    api
      .get<Contact[]>("/contacts")
      .then(({ data }): void => {
        setContacts(data);
      })
      .catch((err: unknown): void => {
        setContactsError(apiErrorMessage(err, "Could not load contacts"));
      });
  }, [pitchId, navigate]);

  async function deletePitch(): Promise<void> {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete(`/pitches/${String(pitchId)}`);
      void navigate("/pitches");
    } catch (err) {
      setDeleteError(apiErrorMessage(err, "Failed to delete pitch"));
      setDeleting(false);
    }
  }

  /** Takes the set the server confirmed, so the card needs no re-fetch. */
  function contactsAttached(contactIds: string[]): void {
    setPitch((prev): ExtendedPitch | null =>
      prev ? { ...prev, contact_ids: contactIds } : prev,
    );
    setAddingContacts(false);
  }

  async function removeContact(contactId: string): Promise<void> {
    // From the pitch, not the rendered rows: the endpoint replaces the whole
    // set, so an id the directory could not name has to go back out too.
    const remaining = (pitch?.contact_ids ?? []).filter(
      (id): boolean => id !== contactId,
    );
    setRemovingContact(contactId);
    setRemoveError(null);
    try {
      const { data } = await api.patch<{ contact_ids?: string[] }>(
        `/pitches/${String(pitchId)}`,
        { contact_ids: remaining },
      );
      const confirmed = data.contact_ids ?? remaining;
      setPitch((prev): ExtendedPitch | null =>
        prev ? { ...prev, contact_ids: confirmed } : prev,
      );
    } catch (err) {
      setRemoveError(apiErrorMessage(err, "Failed to remove contact"));
    } finally {
      setRemovingContact(null);
    }
  }

  /** Folds a contact created in the dialog into the directory the card names
   *  its rows from. */
  function contactCreated(contact: Contact): void {
    setContacts((prev): Contact[] => [...prev, contact]);
  }

  function getUserName(userId: string | undefined): string | null {
    if (!userId) return null;
    const u = users.find((u): boolean => u.id === userId);
    return u ? u.display_name : null;
  }

  if (loading || !pitch || !pitchId) {
    return (
      <Layout>
        <p className="text-navy-400">Loading pitch...</p>
      </Layout>
    );
  }

  const stage = STAGE_MAP[pitch.current_stage];
  const leadName = getUserName(pitch.lead_id);
  // From the pitch, not the resolved names, so the count is right even when the
  // directory lookup failed.
  const contactIds = pitch.contact_ids ?? [];
  const people = pickedContacts(contacts, contactIds);

  return (
    <Layout>
      <PageHeader
        title={pitch.title}
        description={pitch.short_description ?? ""}
        action={
          <div className="flex gap-2">
            {canEdit && (
              <>
                <Link
                  to={`/pitches/${pitchId}/edit`}
                  className="border border-navy-200 text-navy-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
                >
                  Edit
                </Link>
                <Link
                  to={`/meetings/new?pitch_id=${pitchId}`}
                  className="border border-navy-200 text-navy-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
                >
                  Log Meeting
                </Link>
                <Link
                  to={`/assessments/new?pitch_id=${pitchId}`}
                  className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
                >
                  New Assessment
                </Link>
              </>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError("");
                  setShowDelete(true);
                }}
                className="border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-red-400 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        }
      />

      {showDelete && (
        <DeletePitchModal
          pitchTitle={pitch.title}
          meetingCount={meetings.length}
          assessmentCount={assessments.length}
          error={deleteError}
          deleting={deleting}
          onCancel={() => {
            setShowDelete(false);
          }}
          onConfirm={() => {
            void deletePitch();
          }}
        />
      )}

      {addingContacts && (
        <AddPitchContactsModal
          pitchId={pitchId}
          contacts={contacts}
          attachedIds={contactIds}
          onContactCreated={contactCreated}
          onSaved={contactsAttached}
          onCancel={() => {
            setAddingContacts(false);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Pitch info + Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/*
            Next step leads the column rather than sitting in the details list
            below: it is the one thing on this page that asks the reader to act,
            so it should not have to compete with the reference fields.
          */}
          {pitch.next_step?.trim() && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-teal-800 uppercase tracking-wide mb-2">
                Next Step
              </h2>
              <p className="text-sm text-navy-900 whitespace-pre-line">
                {pitch.next_step}
              </p>
            </div>
          )}

          {/* Pitch details card */}
          <div className="bg-white rounded-xl border border-navy-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${stage.lightColor}`}
              >
                {stage.label}
              </span>
              {/* Beside the stage badge, where a reader already looks for
                  decision context. */}
              {pitch.decline_reason && (
                <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded font-medium">
                  {DECLINE_REASON_LABELS[pitch.decline_reason] ??
                    pitch.decline_reason}
                </span>
              )}
              {pitch.is_confidential && (
                <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium">
                  Confidential
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {pitch.source && (
                <div>
                  <dt className="text-navy-400">Source</dt>
                  <dd className="text-navy-900">
                    {SOURCE_LABELS[pitch.source] ?? pitch.source}
                  </dd>
                </div>
              )}
              {pitch.funding_pathway && (
                <div>
                  <dt className="text-navy-400">Funding Pathway</dt>
                  <dd className="text-navy-900">
                    {FUNDING_LABELS[pitch.funding_pathway] ??
                      pitch.funding_pathway}
                  </dd>
                </div>
              )}
              {leadName && (
                <div>
                  <dt className="text-navy-400">Rozetta Lead</dt>
                  <dd className="text-navy-900">{leadName}</dd>
                </div>
              )}
              {pitch.submission_date && (
                <div>
                  <dt className="text-navy-400">Submitted</dt>
                  <dd className="text-navy-900">{pitch.submission_date}</dd>
                </div>
              )}
              {org && (
                <div>
                  <dt className="text-navy-400">Organisation</dt>
                  <dd className="text-navy-900">{org.name}</dd>
                </div>
              )}
              {pitch.domain_tags && (
                <div className="col-span-2">
                  <dt className="text-navy-400 mb-1">Domains</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {pitch.domain_tags.split(",").map((tag: string) => (
                      <span
                        key={tag}
                        className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded capitalize"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {pitch.masterplan_alignment && (
                <div className="col-span-2">
                  <dt className="text-navy-400">Masterplan Alignment</dt>
                  <dd className="text-navy-900">
                    {pitch.masterplan_alignment}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-xl border border-navy-100 p-6">
            <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-4">
              Activity Timeline
            </h2>
            <ActivityTimeline pitchId={pitchId} />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Contacts on this pitch */}
          <div
            data-testid="pitch-contacts"
            className="bg-white rounded-xl border border-navy-100 p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide">
                Contacts ({String(contactIds.length)})
              </h2>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setAddingContacts(true);
                  }}
                  className="text-xs text-navy-600 hover:text-navy-900 font-medium"
                >
                  + Add
                </button>
              )}
            </div>
            {contactsError ? (
              <p className="text-sm text-red-600">{contactsError}</p>
            ) : people.length === 0 ? (
              <p className="text-sm text-navy-400">No contacts recorded.</p>
            ) : (
              <ul className="space-y-2">
                {people.map((c: Contact) => (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy-900">
                        {contactName(c)}
                      </p>
                      {c.email && (
                        <p className="text-xs text-navy-500">{c.email}</p>
                      )}
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={`Remove ${contactName(c)} from this pitch`}
                        onClick={() => {
                          void removeContact(c.id);
                        }}
                        // One at a time: two whole-set writes computed from the
                        // same starting set each restore the other's contact.
                        disabled={removingContact !== null}
                        className="text-navy-300 hover:text-red-600 leading-none px-1 transition-colors disabled:opacity-50"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {removeError && (
              <p className="text-sm text-red-600 mt-3">{removeError}</p>
            )}
          </div>

          {/* Meetings for this pitch */}
          <div className="bg-white rounded-xl border border-navy-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide">
                Meetings ({String(meetings.length)})
              </h2>
              {canEdit && (
                <Link
                  to={`/meetings/new?pitch_id=${pitchId}`}
                  className="text-xs text-navy-600 hover:text-navy-900 font-medium"
                >
                  + Log
                </Link>
              )}
            </div>
            {meetings.length === 0 ? (
              <p className="text-sm text-navy-400">No meetings recorded.</p>
            ) : (
              <ul className="space-y-2">
                {meetings.map((m: Meeting) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        void navigate(`/meetings/${m.id}`);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-navy-50/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-navy-900">
                        {m.title}
                      </p>
                      <p className="text-xs text-navy-500">{m.meeting_date}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Assessments for this pitch */}
          <div className="bg-white rounded-xl border border-navy-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide">
                Assessments ({assessments.length})
              </h2>
              {canEdit && (
                <Link
                  to={`/assessments/new?pitch_id=${pitchId}`}
                  className="text-xs text-navy-600 hover:text-navy-900 font-medium"
                >
                  + New
                </Link>
              )}
            </div>
            {assessments.length === 0 ? (
              <p className="text-sm text-navy-400">No assessments yet.</p>
            ) : (
              <ul className="space-y-2">
                {assessments
                  .sort((a: Assessment, b: Assessment) => b.version - a.version)
                  .map((a: Assessment) => {
                    const recColorMap: Record<string, string> = {
                      proceed: "bg-green-100 text-green-700",
                      park: "bg-amber-100 text-amber-700",
                      decline: "bg-red-100 text-red-700",
                    };
                    const recColor: string =
                      recColorMap[a.recommendation] ?? "bg-gray-100";

                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => {
                            void navigate(`/assessments/${a.id}`);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-navy-50/50 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium text-navy-900">
                              v{String(a.version)}
                            </p>
                            <p className="text-xs text-navy-500">
                              {a.assessment_date}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${recColor}`}
                          >
                            {a.recommendation}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>

          {/* File links */}
          <FileLinks pitchId={pitchId} />
        </div>
      </div>
    </Layout>
  );
}
