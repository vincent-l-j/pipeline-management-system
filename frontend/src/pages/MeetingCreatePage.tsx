/**
 * Create a new meeting record linked to a pitch.
 * Form captures title, date, time, platform, pitch link,
 * and optionally summary/key points/action items/follow-up.
 */

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AxiosError } from "axios";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import api from "../services/api";
import OptionSelect, { type SelectOption } from "../components/ui/OptionSelect";

interface Pitch {
  id: string;
  title: string;
}

interface MeetingForm {
  title: string;
  meeting_date: string;
  meeting_time: string;
  platform: string;
  pitch_id: string;
  summary: string;
  key_points: string;
  action_items: string;
  follow_up_date: string;
  recording_link: string;
  transcript_path: string;
}

interface MeetingResponse {
  id: string;
}

interface ApiErrorResponse {
  detail?: string;
}

const PLATFORMS: readonly SelectOption[] = [
  { value: "teams", label: "Microsoft Teams" },
  { value: "zoom", label: "Zoom" },
  { value: "in_person", label: "In Person" },
  { value: "phone", label: "Phone" },
  { value: "other", label: "Other" },
];

export default function MeetingCreatePage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<MeetingForm>({
    title: "",
    meeting_date: new Date().toISOString().split("T")[0],
    meeting_time: "",
    platform: "teams",
    pitch_id: searchParams.get("pitch_id") ?? "",
    summary: "",
    key_points: "",
    action_items: "",
    follow_up_date: "",
    recording_link: "",
    transcript_path: "",
  });

  useEffect((): void => {
    api
      .get<Pitch[]>("/pitches")
      .then(({ data }) => {
        setPitches(data);
      })
      .catch(() => {
        // Silently handle error loading pitches
      });
  }, []);

  const update = (field: keyof MeetingForm, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      meeting_time: form.meeting_time || null,
      follow_up_date: form.follow_up_date || null,
      recording_link: form.recording_link || null,
      transcript_path: form.transcript_path || null,
    };

    try {
      const { data } = await api.post<MeetingResponse>("/meetings", payload);
      void navigate(`/meetings/${data.id}`);
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      setError(axiosError.response?.data.detail ?? "Failed to create meeting");
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300";
  const labelClass = "block text-sm font-medium text-navy-700 mb-1";

  return (
    <Layout>
      <PageHeader
        title="Log New Meeting"
        description="Record a meeting linked to a pitch"
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
          <label className={labelClass}>Meeting Title *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              update("title", e.target.value);
            }}
            placeholder="e.g. Discovery call with AgriTech Co"
            className={inputClass}
          />
        </div>

        {/* Pitch link */}
        <OptionSelect
          id="meeting-pitch"
          label="Linked Pitch *"
          placeholder="Select a pitch..."
          required
          value={form.pitch_id}
          options={pitches.map((p: Pitch) => ({ value: p.id, label: p.title }))}
          onChange={(pitch_id) => {
            update("pitch_id", pitch_id);
          }}
        />

        {/* Date, Time, Platform — row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Date *</label>
            <input
              type="date"
              required
              value={form.meeting_date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                update("meeting_date", e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Time</label>
            <input
              type="time"
              value={form.meeting_time}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                update("meeting_time", e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <OptionSelect
            id="meeting-platform"
            label="Platform"
            value={form.platform}
            options={PLATFORMS}
            onChange={(platform) => {
              update("platform", platform);
            }}
          />
        </div>

        {/* Summary */}
        <div>
          <label className={labelClass}>Summary</label>
          <textarea
            rows={3}
            value={form.summary}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              update("summary", e.target.value);
            }}
            placeholder="Brief summary of the meeting..."
            className={inputClass}
          />
        </div>

        {/* Key Points */}
        <div>
          <label className={labelClass}>Key Points</label>
          <textarea
            rows={3}
            value={form.key_points}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              update("key_points", e.target.value);
            }}
            placeholder="Main discussion points (one per line)..."
            className={inputClass}
          />
        </div>

        {/* Action Items */}
        <div>
          <label className={labelClass}>Action Items</label>
          <textarea
            rows={3}
            value={form.action_items}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              update("action_items", e.target.value);
            }}
            placeholder="Next steps and tasks (one per line)..."
            className={inputClass}
          />
        </div>

        {/* Follow-up Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Follow-up Date</label>
            <input
              type="date"
              value={form.follow_up_date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                update("follow_up_date", e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Recording Link</label>
            <input
              type="text"
              value={form.recording_link}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                update("recording_link", e.target.value);
              }}
              placeholder="URL to recording..."
              className={inputClass}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-navy-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Meeting"}
          </button>
          <button
            type="button"
            onClick={() => {
              void navigate("/meetings");
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
