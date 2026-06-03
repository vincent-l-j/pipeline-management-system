/**
 * Meeting detail page — view and edit a single meeting record.
 * Shows meeting info, attendees, and provides the AI notetaker import.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import MeetingAttendees from '../components/meetings/MeetingAttendees'
import AINoteImporter from '../components/meetings/AINoteImporter'
import api from '../services/api'

const PLATFORM_LABELS = {
  teams: 'Microsoft Teams',
  zoom: 'Zoom',
  in_person: 'In Person',
  phone: 'Phone',
  other: 'Other',
}

export default function MeetingDetailPage() {
  const { meetingId } = useParams()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(`/meetings/${meetingId}`)
      .then(({ data }) => {
        setMeeting(data)
        setLoading(false)
      })
      .catch(() => {
        navigate('/meetings')
      })
  }, [meetingId, navigate])

  function startEditing() {
    setEditForm({
      title: meeting.title,
      summary: meeting.summary || '',
      key_points: meeting.key_points || '',
      action_items: meeting.action_items || '',
      follow_up_date: meeting.follow_up_date || '',
      recording_link: meeting.recording_link || '',
    })
    setEditing(true)
  }

  async function saveEdits() {
    setSaving(true)
    try {
      const payload = {
        ...editForm,
        follow_up_date: editForm.follow_up_date || null,
        recording_link: editForm.recording_link || null,
      }
      const { data } = await api.patch(`/meetings/${meetingId}`, payload)
      setMeeting(data)
      setEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
    }
    setSaving(false)
  }

  function handleNoteImport(parsed) {
    // Apply parsed AI notes to the edit form so the user can review
    setEditForm({
      title: meeting.title,
      summary: parsed.summary || '',
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points.join('\n') : parsed.key_points || '',
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items.join('\n') : parsed.action_items || '',
      follow_up_date: parsed.follow_up_date || '',
      recording_link: meeting.recording_link || '',
    })
    setEditing(true)
  }

  if (loading) {
    return <Layout><p className="text-navy-400">Loading meeting...</p></Layout>
  }

  const inputClass = "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300"
  const labelClass = "block text-sm font-medium text-navy-700 mb-1"

  return (
    <Layout>
      <PageHeader
        title={meeting.title}
        description={`${meeting.meeting_date} · ${PLATFORM_LABELS[meeting.platform] || meeting.platform || 'Unknown platform'}`}
        action={
          <div className="flex gap-2">
            {!editing && (
              <button
                onClick={startEditing}
                className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
              >
                Edit Meeting
              </button>
            )}
            <Link
              to="/meetings"
              className="border border-navy-200 text-navy-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
            >
              Back to Meetings
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content — left 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {editing ? (
            /* Edit mode */
            <div className="bg-white rounded-xl border border-navy-100 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-navy-900">Edit Meeting Details</h2>

              <div>
                <label className={labelClass}>Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Summary</label>
                <textarea
                  rows={4}
                  value={editForm.summary}
                  onChange={e => setEditForm(prev => ({ ...prev, summary: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Key Points</label>
                <textarea
                  rows={4}
                  value={editForm.key_points}
                  onChange={e => setEditForm(prev => ({ ...prev, key_points: e.target.value }))}
                  placeholder="One point per line..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Action Items</label>
                <textarea
                  rows={4}
                  value={editForm.action_items}
                  onChange={e => setEditForm(prev => ({ ...prev, action_items: e.target.value }))}
                  placeholder="One item per line..."
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Follow-up Date</label>
                  <input
                    type="date"
                    value={editForm.follow_up_date}
                    onChange={e => setEditForm(prev => ({ ...prev, follow_up_date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Recording Link</label>
                  <input
                    type="text"
                    value={editForm.recording_link}
                    onChange={e => setEditForm(prev => ({ ...prev, recording_link: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveEdits}
                  disabled={saving}
                  className="bg-navy-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="border border-navy-200 text-navy-600 px-5 py-2 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <>
              {/* Summary */}
              <div className="bg-white rounded-xl border border-navy-100 p-6">
                <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-3">Summary</h2>
                <p className="text-sm text-navy-800 whitespace-pre-wrap">
                  {meeting.summary || 'No summary recorded.'}
                </p>
              </div>

              {/* Key Points */}
              <div className="bg-white rounded-xl border border-navy-100 p-6">
                <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-3">Key Points</h2>
                {meeting.key_points ? (
                  <div className="text-sm text-navy-800 whitespace-pre-wrap">{meeting.key_points}</div>
                ) : (
                  <p className="text-sm text-navy-400">No key points recorded.</p>
                )}
              </div>

              {/* Action Items */}
              <div className="bg-white rounded-xl border border-navy-100 p-6">
                <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-3">Action Items</h2>
                {meeting.action_items ? (
                  <div className="text-sm text-navy-800 whitespace-pre-wrap">{meeting.action_items}</div>
                ) : (
                  <p className="text-sm text-navy-400">No action items recorded.</p>
                )}
              </div>
            </>
          )}

          {/* AI Notetaker import section */}
          <AINoteImporter onImport={handleNoteImport} />
        </div>

        {/* Sidebar — right column */}
        <div className="space-y-6">
          {/* Meeting details card */}
          <div className="bg-white rounded-xl border border-navy-100 p-6">
            <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-3">Details</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-navy-400">Date</dt>
                <dd className="text-navy-900 font-medium">{meeting.meeting_date}</dd>
              </div>
              {meeting.meeting_time && (
                <div>
                  <dt className="text-navy-400">Time</dt>
                  <dd className="text-navy-900">{meeting.meeting_time}</dd>
                </div>
              )}
              <div>
                <dt className="text-navy-400">Platform</dt>
                <dd className="text-navy-900">{PLATFORM_LABELS[meeting.platform] || '-'}</dd>
              </div>
              {meeting.follow_up_date && (
                <div>
                  <dt className="text-navy-400">Follow-up Date</dt>
                  <dd className="text-navy-900 font-medium">{meeting.follow_up_date}</dd>
                </div>
              )}
              {meeting.recording_link && (
                <div>
                  <dt className="text-navy-400">Recording</dt>
                  <dd>
                    <a href={meeting.recording_link} target="_blank" rel="noopener noreferrer"
                       className="text-navy-600 underline hover:text-navy-900">
                      View recording
                    </a>
                  </dd>
                </div>
              )}
              {meeting.ai_import_status && (
                <div>
                  <dt className="text-navy-400">AI Import</dt>
                  <dd className="text-navy-900 capitalize">{meeting.ai_import_status}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Attendees */}
          <MeetingAttendees meetingId={meetingId} />
        </div>
      </div>
    </Layout>
  )
}
