import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const PLATFORM_LABELS = {
  teams: 'Microsoft Teams',
  zoom: 'Zoom',
  in_person: 'In Person',
  phone: 'Phone',
  other: 'Other',
}

export default function MeetingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)

  const canCreate = user?.role === 'admin' || user?.role === 'assessor'

  useEffect(() => {
    api.get('/meetings').then(({ data }) => {
      setMeetings(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <PageHeader
        title="Meetings"
        description={`${meetings.length} meeting${meetings.length !== 1 ? 's' : ''} recorded`}
        action={canCreate && (
          <Link
            to="/meetings/new"
            className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
          >
            Log Meeting
          </Link>
        )}
      />

      {loading ? (
        <p className="text-navy-400">Loading...</p>
      ) : meetings.length === 0 ? (
        <div className="bg-white rounded-xl border border-navy-100 p-8 text-center">
          <p className="text-navy-500 mb-3">No meetings recorded yet.</p>
          {canCreate && (
            <Link
              to="/meetings/new"
              className="text-sm text-navy-600 underline hover:text-navy-900"
            >
              Log your first meeting
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Platform</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Follow-up</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">AI Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {meetings.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/meetings/${m.id}`)}
                  className="hover:bg-navy-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-navy-900">{m.title}</td>
                  <td className="px-4 py-3 text-navy-500">{m.meeting_date}</td>
                  <td className="px-4 py-3 text-navy-500">{PLATFORM_LABELS[m.platform] || m.platform || '-'}</td>
                  <td className="px-4 py-3 text-navy-500">{m.follow_up_date || '-'}</td>
                  <td className="px-4 py-3">
                    {m.ai_import_status ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded capitalize">
                        {m.ai_import_status}
                      </span>
                    ) : (
                      <span className="text-navy-300">-</span>
                    )}
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
