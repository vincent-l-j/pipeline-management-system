/**
 * Create a new meeting record linked to a pitch.
 * Form captures title, date, time, platform, pitch link,
 * and optionally summary/key points/action items/follow-up.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'

const PLATFORMS = [
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'in_person', label: 'In Person' },
  { value: 'phone', label: 'Phone' },
  { value: 'other', label: 'Other' },
]

export default function MeetingCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pitches, setPitches] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    title: '',
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_time: '',
    platform: 'teams',
    pitch_id: searchParams.get('pitch_id') || '',
    summary: '',
    key_points: '',
    action_items: '',
    follow_up_date: '',
    recording_link: '',
    transcript_path: '',
  })

  useEffect(() => {
    api.get('/pitches').then(({ data }) => setPitches(data))
  }, [])

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      ...form,
      meeting_time: form.meeting_time || null,
      follow_up_date: form.follow_up_date || null,
      recording_link: form.recording_link || null,
      transcript_path: form.transcript_path || null,
    }

    try {
      const { data } = await api.post('/meetings', payload)
      navigate(`/meetings/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create meeting')
      setSaving(false)
    }
  }

  const inputClass = "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300"
  const labelClass = "block text-sm font-medium text-navy-700 mb-1"

  return (
    <Layout>
      <PageHeader title="Log New Meeting" description="Record a meeting linked to a pitch" />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
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
            onChange={e => update('title', e.target.value)}
            placeholder="e.g. Discovery call with AgriTech Co"
            className={inputClass}
          />
        </div>

        {/* Pitch link */}
        <div>
          <label className={labelClass}>Linked Pitch *</label>
          <select
            required
            value={form.pitch_id}
            onChange={e => update('pitch_id', e.target.value)}
            className={inputClass}
          >
            <option value="">Select a pitch...</option>
            {pitches.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* Date, Time, Platform — row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Date *</label>
            <input
              type="date"
              required
              value={form.meeting_date}
              onChange={e => update('meeting_date', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Time</label>
            <input
              type="time"
              value={form.meeting_time}
              onChange={e => update('meeting_time', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Platform</label>
            <select
              value={form.platform}
              onChange={e => update('platform', e.target.value)}
              className={inputClass}
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div>
          <label className={labelClass}>Summary</label>
          <textarea
            rows={3}
            value={form.summary}
            onChange={e => update('summary', e.target.value)}
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
            onChange={e => update('key_points', e.target.value)}
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
            onChange={e => update('action_items', e.target.value)}
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
              onChange={e => update('follow_up_date', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Recording Link</label>
            <input
              type="text"
              value={form.recording_link}
              onChange={e => update('recording_link', e.target.value)}
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
            {saving ? 'Saving...' : 'Save Meeting'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/meetings')}
            className="border border-navy-200 text-navy-600 px-6 py-2.5 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  )
}
