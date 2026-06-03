/**
 * Assessment detail page — shows a single assessment's scoring card
 * and the full version history for that pitch.
 *
 * Prior versions are NEVER overwritten — they are always displayed
 * in chronological order so the full assessment trail is visible.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import ScoringCard from '../components/assessments/ScoringCard'
import api from '../services/api'

export default function AssessmentDetailPage() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  const [assessment, setAssessment] = useState(null)
  const [allVersions, setAllVersions] = useState([])
  const [users, setUsers] = useState([])
  const [pitch, setPitch] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/assessments/${assessmentId}`),
      api.get('/users'),
    ]).then(([assessRes, usersRes]) => {
      const a = assessRes.data
      setAssessment(a)
      setUsers(usersRes.data)

      // Load the pitch and all assessments for this pitch
      return Promise.all([
        api.get(`/pitches/${a.pitch_id}`),
        api.get(`/assessments?pitch_id=${a.pitch_id}`),
      ])
    }).then(([pitchRes, versionsRes]) => {
      setPitch(pitchRes.data)
      // Sort by version descending (newest first)
      setAllVersions(versionsRes.data.sort((a, b) => b.version - a.version))
      setLoading(false)
    }).catch(() => {
      navigate('/assessments')
    })
  }, [assessmentId, navigate])

  function getUserName(userId) {
    const u = users.find(u => u.id === userId)
    return u ? u.display_name : 'Unknown'
  }

  if (loading) {
    return <Layout><p className="text-navy-400">Loading assessment...</p></Layout>
  }

  return (
    <Layout>
      <PageHeader
        title={`Assessment for: ${pitch?.title || 'Unknown Pitch'}`}
        description={`Version ${assessment.version} — ${assessment.assessment_date}`}
        action={
          <div className="flex gap-2">
            <Link
              to={`/assessments/new?pitch_id=${assessment.pitch_id}`}
              className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
            >
              New Assessment
            </Link>
            <Link
              to="/assessments"
              className="border border-navy-200 text-navy-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
            >
              Back to List
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main — current assessment */}
        <div className="lg:col-span-2">
          <ScoringCard
            assessment={assessment}
            assessorName={getUserName(assessment.assessor_id)}
          />
        </div>

        {/* Sidebar — version history */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-navy-100 p-6">
            <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-3">
              Assessment History
            </h2>
            <p className="text-xs text-navy-400 mb-4">
              {allVersions.length} version{allVersions.length !== 1 ? 's' : ''} recorded for this pitch.
              All prior assessments are preserved.
            </p>

            <div className="space-y-2">
              {allVersions.map(v => {
                const isCurrent = v.id === assessment.id
                const recColor = {
                  proceed: 'bg-green-100 text-green-700',
                  park: 'bg-amber-100 text-amber-700',
                  decline: 'bg-red-100 text-red-700',
                }[v.recommendation] || 'bg-gray-100'

                return (
                  <button
                    key={v.id}
                    onClick={() => navigate(`/assessments/${v.id}`)}
                    className={`
                      w-full text-left p-3 rounded-lg border transition-colors
                      ${isCurrent
                        ? 'border-navy-300 bg-navy-50'
                        : 'border-navy-100 hover:bg-navy-50/50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-navy-900">
                        v{v.version}
                        {isCurrent && <span className="text-xs text-navy-400 ml-1">(viewing)</span>}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${recColor}`}>
                        {v.recommendation}
                      </span>
                    </div>
                    <p className="text-xs text-navy-500">
                      {getUserName(v.assessor_id)} — {v.assessment_date}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pitch info card */}
          {pitch && (
            <div className="bg-white rounded-xl border border-navy-100 p-6">
              <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-3">
                Linked Pitch
              </h2>
              <h3 className="text-sm font-semibold text-navy-900">{pitch.title}</h3>
              {pitch.short_description && (
                <p className="text-xs text-navy-500 mt-1">{pitch.short_description}</p>
              )}
              <p className="text-xs text-navy-400 mt-2 capitalize">
                Stage: {pitch.current_stage?.replace('_', ' ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
