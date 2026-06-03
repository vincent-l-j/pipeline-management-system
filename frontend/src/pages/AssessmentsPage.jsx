import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import { CRITERIA } from '../components/assessments/AssessmentConfig'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const recommendationBadge = {
  proceed: 'bg-green-100 text-green-700',
  park: 'bg-amber-100 text-amber-700',
  decline: 'bg-red-100 text-red-700',
}

export default function AssessmentsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState([])
  const [pitches, setPitches] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const canCreate = user?.role === 'admin' || user?.role === 'assessor'

  useEffect(() => {
    Promise.all([
      api.get('/assessments'),
      api.get('/pitches'),
      api.get('/users'),
    ]).then(([aRes, pRes, uRes]) => {
      setAssessments(aRes.data)
      setPitches(pRes.data)
      setUsers(uRes.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function getPitchTitle(pitchId) {
    const p = pitches.find(p => p.id === pitchId)
    return p ? p.title : 'Unknown'
  }

  function getAssessorName(assessorId) {
    const u = users.find(u => u.id === assessorId)
    return u ? u.display_name : 'Unknown'
  }

  function getAvgScore(a) {
    const total = CRITERIA.reduce((sum, c) => sum + (a[c.key] || 0), 0)
    return (total / CRITERIA.length).toFixed(1)
  }

  return (
    <Layout>
      <PageHeader
        title="Assessments"
        description={`${assessments.length} assessment${assessments.length !== 1 ? 's' : ''} recorded`}
        action={canCreate && (
          <Link
            to="/assessments/new"
            className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
          >
            New Assessment
          </Link>
        )}
      />

      {loading ? (
        <p className="text-navy-400">Loading...</p>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy-100 p-8 text-center">
          <p className="text-navy-500 mb-3">No assessments yet.</p>
          {canCreate && (
            <Link
              to="/assessments/new"
              className="text-sm text-navy-600 underline hover:text-navy-900"
            >
              Create your first assessment
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Pitch</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Assessor</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Avg Score</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Recommendation</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {assessments.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/assessments/${a.id}`)}
                  className="hover:bg-navy-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-navy-900">{getPitchTitle(a.pitch_id)}</td>
                  <td className="px-4 py-3 text-navy-500">{getAssessorName(a.assessor_id)}</td>
                  <td className="px-4 py-3 text-navy-500">{a.assessment_date}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-navy-900">{getAvgScore(a)}</span>
                    <span className="text-navy-400">/5</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full capitalize ${recommendationBadge[a.recommendation] || 'bg-gray-100'}`}>
                      {a.recommendation}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-500">v{a.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
