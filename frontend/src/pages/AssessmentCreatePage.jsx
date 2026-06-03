/**
 * Create a new assessment for a pitch.
 * Shows the 6-criteria scoring card with interactive score selectors,
 * recommendation selection, and free-text rationale.
 *
 * This always creates a NEW assessment version — never overwrites prior ones.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import ScoreSelector from '../components/assessments/ScoreSelector'
import { CRITERIA, RECOMMENDATION_OPTIONS } from '../components/assessments/AssessmentConfig'
import api from '../services/api'

export default function AssessmentCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pitches, setPitches] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    pitch_id: searchParams.get('pitch_id') || '',
    assessment_date: new Date().toISOString().split('T')[0],
    recommendation: '',
    rationale: '',
    national_impact: 0,
    translation_readiness: 0,
    team_capability: 0,
    ecosystem_fit: 0,
    funding_pathway_clarity: 0,
    masterplan_alignment: 0,
  })

  useEffect(() => {
    api.get('/pitches').then(({ data }) => setPitches(data))
  }, [])

  function updateScore(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const allScored = CRITERIA.every(c => form[c.key] >= 1)
  const totalScore = CRITERIA.reduce((sum, c) => sum + (form[c.key] || 0), 0)
  const avgScore = allScored ? (totalScore / CRITERIA.length).toFixed(1) : '-'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!allScored) {
      setError('Please score all six criteria before submitting.')
      return
    }
    if (!form.recommendation) {
      setError('Please select a recommendation (Proceed, Park, or Decline).')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const { data } = await api.post('/assessments', form)
      navigate(`/assessments/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create assessment')
      setSaving(false)
    }
  }

  return (
    <Layout>
      <PageHeader
        title="New Assessment"
        description="Score a pitch against Rozetta's six assessment criteria"
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Pitch and date */}
        <div className="bg-white rounded-xl border border-navy-100 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Pitch *</label>
              <select
                required
                value={form.pitch_id}
                onChange={e => setForm(prev => ({ ...prev, pitch_id: e.target.value }))}
                className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300"
              >
                <option value="">Select a pitch...</option>
                {pitches.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Assessment Date *</label>
              <input
                type="date"
                required
                value={form.assessment_date}
                onChange={e => setForm(prev => ({ ...prev, assessment_date: e.target.value }))}
                className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300"
              />
            </div>
          </div>
        </div>

        {/* Scoring card */}
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <div className="px-6 py-4 bg-navy-50 border-b border-navy-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-navy-900">Scoring Card</h2>
              <p className="text-xs text-navy-500">Score each criterion from 1 (Very Low) to 5 (Very High)</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-navy-900">{avgScore}</p>
              <p className="text-[10px] text-navy-400 uppercase tracking-wide">Avg Score</p>
            </div>
          </div>

          <div className="px-6 py-2 divide-y divide-navy-50">
            {CRITERIA.map(criterion => (
              <ScoreSelector
                key={criterion.key}
                criterion={criterion}
                value={form[criterion.key]}
                onChange={(score) => updateScore(criterion.key, score)}
              />
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <div className="bg-white rounded-xl border border-navy-100 p-6">
          <h2 className="text-sm font-semibold text-navy-900 mb-3">Recommendation *</h2>
          <div className="flex gap-3 mb-5">
            {RECOMMENDATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, recommendation: opt.value }))}
                className={`
                  flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all
                  ${form.recommendation === opt.value
                    ? `${opt.color} border-current shadow-sm`
                    : 'border-navy-100 text-navy-400 hover:border-navy-200'
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Rationale</label>
            <textarea
              rows={4}
              value={form.rationale}
              onChange={e => setForm(prev => ({ ...prev, rationale: e.target.value }))}
              placeholder="Explain the reasoning behind your recommendation..."
              className="w-full border border-navy-200 rounded-lg px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-300"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-navy-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit Assessment'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/assessments')}
            className="border border-navy-200 text-navy-600 px-6 py-2.5 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-navy-400">
          This creates a new assessment version. Prior assessments for this pitch are preserved and always viewable.
        </p>
      </form>
    </Layout>
  )
}
