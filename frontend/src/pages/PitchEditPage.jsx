/**
 * Edit an existing pitch. Reuses the create form, pre-filled from the pitch,
 * and submits a PATCH on save. Pipeline stage is intentionally NOT editable
 * here — stage changes go through the Kanban board so every transition is
 * audited. Viewers are redirected back to the detail page.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const SOURCES = [
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'event', label: 'Event' },
  { value: 'cold_outreach', label: 'Cold Outreach' },
  { value: 'internal', label: 'Internal' },
]

const FUNDING_PATHWAYS = [
  { value: 'crc_bid', label: 'CRC Bid' },
  { value: 'rdti', label: 'RDTI' },
  { value: 'philanthropic', label: 'Philanthropic' },
  { value: 'government_grant', label: 'Government Grant' },
  { value: 'private', label: 'Private' },
  { value: 'other', label: 'Other' },
]

const DOMAIN_OPTIONS = [
  'climate', 'health', 'digital', 'forestry', 'agri', 'education', 'other',
]

export default function PitchEditPage() {
  const { pitchId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'assessor'

  const [organisations, setOrganisations] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    title: '',
    short_description: '',
    source: '',
    funding_pathway: '',
    domain_tags: [],
    masterplan_alignment: '',
    is_confidential: false,
    organisation_id: '',
    lead_id: '',
  })

  useEffect(() => {
    if (!canEdit) return
    Promise.all([
      api.get(`/pitches/${pitchId}`),
      api.get('/organisations'),
      api.get('/users'),
    ]).then(([pitchRes, orgsRes, usersRes]) => {
      const p = pitchRes.data
      setForm({
        title: p.title || '',
        short_description: p.short_description || '',
        source: p.source || '',
        funding_pathway: p.funding_pathway || '',
        domain_tags: p.domain_tags ? p.domain_tags.split(',').map(t => t.trim()) : [],
        masterplan_alignment: p.masterplan_alignment || '',
        is_confidential: p.is_confidential || false,
        organisation_id: p.organisation_id || '',
        lead_id: p.lead_id || '',
      })
      setOrganisations(orgsRes.data)
      setUsers(usersRes.data)
      setLoading(false)
    }).catch(() => {
      navigate(`/pitches/${pitchId}`)
    })
  }, [pitchId, canEdit, navigate])

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleDomain(domain) {
    setForm(prev => {
      const current = prev.domain_tags
      const next = current.includes(domain)
        ? current.filter(d => d !== domain)
        : [...current, domain]
      return { ...prev, domain_tags: next }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Only PitchUpdate-allowed fields; current_stage is never sent from here.
    const payload = {
      title: form.title,
      short_description: form.short_description || null,
      source: form.source || null,
      funding_pathway: form.funding_pathway || null,
      domain_tags: form.domain_tags.length > 0 ? form.domain_tags.join(',') : null,
      masterplan_alignment: form.masterplan_alignment || null,
      is_confidential: form.is_confidential,
      organisation_id: form.organisation_id || null,
      lead_id: form.lead_id || null,
    }

    try {
      await api.patch(`/pitches/${pitchId}`, payload)
      navigate(`/pitches/${pitchId}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save pitch')
      setSaving(false)
    }
  }

  // Viewers cannot edit — send them back to the detail page (server also enforces).
  if (!canEdit) return <Navigate to={`/pitches/${pitchId}`} replace />

  if (loading) {
    return <Layout><p className="text-navy-400">Loading pitch...</p></Layout>
  }

  const inputClass = "w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300"
  const labelClass = "block text-sm font-medium text-navy-700 mb-1"

  return (
    <Layout>
      <PageHeader title="Edit Pitch" description="Update the initiative's details" />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
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
            onChange={e => update('title', e.target.value)}
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
            onChange={e => update('short_description', e.target.value)}
            placeholder="A brief summary of the initiative (one or two sentences)..."
            className={inputClass}
          />
        </div>

        {/* Source and Funding Pathway — row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Source</label>
            <select
              value={form.source}
              onChange={e => update('source', e.target.value)}
              className={inputClass}
            >
              <option value="">Select source...</option>
              {SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Funding Pathway</label>
            <select
              value={form.funding_pathway}
              onChange={e => update('funding_pathway', e.target.value)}
              className={inputClass}
            >
              <option value="">Select funding pathway...</option>
              {FUNDING_PATHWAYS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Organisation and Lead — row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Organisation</label>
            <select
              value={form.organisation_id}
              onChange={e => update('organisation_id', e.target.value)}
              className={inputClass}
            >
              <option value="">Select organisation...</option>
              {organisations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Rozetta Lead</label>
            <select
              value={form.lead_id}
              onChange={e => update('lead_id', e.target.value)}
              className={inputClass}
            >
              <option value="">Select lead...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Domain Tags */}
        <div>
          <label className={labelClass}>Domains</label>
          <p className="text-xs text-navy-400 mb-2">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_OPTIONS.map(domain => (
              <button
                key={domain}
                type="button"
                onClick={() => toggleDomain(domain)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  form.domain_tags.includes(domain)
                    ? 'bg-teal-100 text-teal-700 border-teal-300'
                    : 'bg-white text-navy-500 border-navy-200 hover:border-navy-400'
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
            onChange={e => update('masterplan_alignment', e.target.value)}
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
            onChange={e => update('is_confidential', e.target.checked)}
            className="w-4 h-4 rounded border-navy-300 text-navy-900 focus:ring-navy-300"
          />
          <label htmlFor="is_confidential" className="text-sm text-navy-700">
            Mark as confidential
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-navy-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/pitches/${pitchId}`)}
            className="border border-navy-200 text-navy-600 px-6 py-2.5 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  )
}
