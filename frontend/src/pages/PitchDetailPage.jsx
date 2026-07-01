/**
 * Pitch detail page — the single view for everything about a pitch.
 *
 * Left column: pitch info, description, stage badge, tags, metadata
 * Right column: activity timeline, file links, linked meetings & assessments
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import ActivityTimeline from '../components/pitch/ActivityTimeline'
import FileLinks from '../components/pitch/FileLinks'
import { STAGE_MAP, SOURCE_LABELS, FUNDING_LABELS } from '../components/pipeline/PipelineConfig'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function PitchDetailPage() {
  const { pitchId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [pitch, setPitch] = useState(null)
  const [users, setUsers] = useState([])
  const [org, setOrg] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)

  const canEdit = user?.role === 'admin' || user?.role === 'assessor'

  useEffect(() => {
    Promise.all([
      api.get(`/pitches/${pitchId}`),
      api.get('/users'),
    ]).then(([pitchRes, usersRes]) => {
      const p = pitchRes.data
      setPitch(p)
      setUsers(usersRes.data)

      // Load related data
      const promises = [
        api.get(`/meetings?pitch_id=${pitchId}`),
        api.get(`/assessments?pitch_id=${pitchId}`),
      ]
      if (p.organisation_id) {
        promises.push(api.get(`/organisations/${p.organisation_id}`))
      }
      return Promise.all(promises)
    }).then(([meetingsRes, assessmentsRes, orgRes]) => {
      setMeetings(meetingsRes.data)
      setAssessments(assessmentsRes.data)
      if (orgRes) setOrg(orgRes.data)
      setLoading(false)
    }).catch(() => {
      navigate('/pitches')
    })
  }, [pitchId, navigate])

  function getUserName(userId) {
    const u = users.find(u => u.id === userId)
    return u ? u.display_name : null
  }

  if (loading) {
    return <Layout><p className="text-navy-400">Loading pitch...</p></Layout>
  }

  const stage = STAGE_MAP[pitch.current_stage]
  const leadName = getUserName(pitch.lead_id)

  return (
    <Layout>
      <PageHeader
        title={pitch.title}
        description={pitch.short_description}
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
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Pitch info + Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pitch details card */}
          <div className="bg-white rounded-xl border border-navy-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              {stage && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stage.lightColor}`}>
                  {stage.label}
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
                  <dd className="text-navy-900">{SOURCE_LABELS[pitch.source] || pitch.source}</dd>
                </div>
              )}
              {pitch.funding_pathway && (
                <div>
                  <dt className="text-navy-400">Funding Pathway</dt>
                  <dd className="text-navy-900">{FUNDING_LABELS[pitch.funding_pathway] || pitch.funding_pathway}</dd>
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
                    {pitch.domain_tags.split(',').map(tag => (
                      <span key={tag} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded capitalize">
                        {tag.trim()}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {pitch.masterplan_alignment && (
                <div className="col-span-2">
                  <dt className="text-navy-400">Masterplan Alignment</dt>
                  <dd className="text-navy-900">{pitch.masterplan_alignment}</dd>
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
          {/* Meetings for this pitch */}
          <div className="bg-white rounded-xl border border-navy-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide">
                Meetings ({meetings.length})
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
                {meetings.map(m => (
                  <li key={m.id}>
                    <button
                      onClick={() => navigate(`/meetings/${m.id}`)}
                      className="w-full text-left p-2 rounded-lg hover:bg-navy-50/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-navy-900">{m.title}</p>
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
                {assessments.sort((a, b) => b.version - a.version).map(a => {
                  const recColor = {
                    proceed: 'bg-green-100 text-green-700',
                    park: 'bg-amber-100 text-amber-700',
                    decline: 'bg-red-100 text-red-700',
                  }[a.recommendation] || 'bg-gray-100'

                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => navigate(`/assessments/${a.id}`)}
                        className="w-full text-left p-2 rounded-lg hover:bg-navy-50/50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-navy-900">v{a.version}</p>
                          <p className="text-xs text-navy-500">{a.assessment_date}</p>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${recColor}`}>
                          {a.recommendation}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* File links */}
          <FileLinks pitchId={pitchId} />
        </div>
      </div>
    </Layout>
  )
}
