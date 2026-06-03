import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

const stageLabels = {
  received: 'Received',
  initial_screen: 'Initial Screen',
  discovery_meeting: 'Discovery Meeting',
  deep_assessment: 'Deep Assessment',
  due_diligence: 'Due Diligence',
  decision_pending: 'Decision Pending',
  active_support: 'Active Support',
  parked: 'Parked',
  declined: 'Declined',
  completed: 'Completed',
}

const stageBadgeColors = {
  received: 'bg-blue-100 text-blue-700',
  initial_screen: 'bg-sky-100 text-sky-700',
  discovery_meeting: 'bg-cyan-100 text-cyan-700',
  deep_assessment: 'bg-teal-100 text-teal-700',
  due_diligence: 'bg-amber-100 text-amber-700',
  decision_pending: 'bg-orange-100 text-orange-700',
  active_support: 'bg-green-100 text-green-700',
  parked: 'bg-gray-100 text-gray-600',
  declined: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

export default function PitchesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'assessor'
  const [pitches, setPitches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/pitches').then(({ data }) => {
      setPitches(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <PageHeader
        title="Pitches"
        description="All initiatives in the pipeline"
        action={
          canEdit && (
            <Link
              to="/pitches/new"
              className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
            >
              New Pitch
            </Link>
          )
        }
      />

      {loading ? (
        <p className="text-navy-400">Loading...</p>
      ) : pitches.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy-100 p-8 text-center">
          <p className="text-navy-500">No pitches yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Stage</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Source</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {pitches.map((pitch) => (
                <tr key={pitch.id} onClick={() => navigate(`/pitches/${pitch.id}`)} className="hover:bg-navy-50/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <span className="font-medium text-navy-900">{pitch.title}</span>
                    {pitch.is_confidential && (
                      <span className="ml-2 text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                        Confidential
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${stageBadgeColors[pitch.current_stage] || 'bg-gray-100'}`}>
                      {stageLabels[pitch.current_stage] || pitch.current_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-500 capitalize">
                    {pitch.source?.replace('_', ' ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    {pitch.submission_date || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
