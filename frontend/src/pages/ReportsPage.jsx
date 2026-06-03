/**
 * Reports page — pipeline summary table, velocity metrics, and CSV exports.
 *
 * Provides:
 * - Full pipeline summary table (all pitches with stage, lead, org, dates)
 * - CSV export buttons for all major views
 * - Print button for print-friendly output
 */

import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'

const STAGE_BADGE = {
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

const CSV_EXPORTS = [
  { key: 'pitches', label: 'Pitches', endpoint: '/reports/export/pitches' },
  { key: 'organisations', label: 'Organisations', endpoint: '/reports/export/organisations' },
  { key: 'contacts', label: 'Contacts', endpoint: '/reports/export/contacts' },
  { key: 'meetings', label: 'Meetings', endpoint: '/reports/export/meetings' },
  { key: 'assessments', label: 'Assessments', endpoint: '/reports/export/assessments' },
]

export default function ReportsPage() {
  const [summary, setSummary] = useState(null)
  const [velocity, setVelocity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/reports/pipeline-summary'),
      api.get('/reports/velocity'),
    ]).then(([sumRes, velRes]) => {
      setSummary(sumRes.data)
      setVelocity(velRes.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleExport(endpoint) {
    try {
      const response = await api.get(endpoint, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      // Extract filename from Content-Disposition header or use default
      const disposition = response.headers['content-disposition']
      const filename = disposition
        ? disposition.split('filename="')[1]?.replace('"', '')
        : 'export.csv'
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <Layout>
        <PageHeader title="Reports" description="Pipeline reports and data exports" />
        <p className="text-navy-400">Loading reports...</p>
      </Layout>
    )
  }

  const filteredPitches = stageFilter
    ? summary.pitches.filter(p => p.current_stage === stageFilter)
    : summary.pitches

  return (
    <Layout>
      <PageHeader
        title="Reports"
        description={`${summary.total} initiatives in the pipeline`}
        action={
          <button
            onClick={handlePrint}
            className="border border-navy-200 text-navy-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors print:hidden"
          >
            Print View
          </button>
        }
      />

      {/* --- CSV Export section --- */}
      <div className="bg-white rounded-xl border border-navy-100 p-6 mb-8 print:hidden">
        <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-3">
          Export Data (CSV)
        </h2>
        <p className="text-xs text-navy-400 mb-4">
          Download any dataset as a CSV file — opens in Excel, Google Sheets, or any spreadsheet application.
        </p>
        <div className="flex flex-wrap gap-3">
          {CSV_EXPORTS.map(exp => (
            <button
              key={exp.key}
              onClick={() => handleExport(exp.endpoint)}
              className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
            >
              Export {exp.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- Conversion metrics --- */}
      {velocity && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <p className="text-2xl font-bold text-navy-900">{velocity.conversion.total_pitches}</p>
            <p className="text-xs text-navy-500 mt-0.5">Total Pitches</p>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <p className="text-2xl font-bold text-navy-900">{velocity.conversion.advanced_to_assessment}</p>
            <p className="text-xs text-navy-500 mt-0.5">Advanced</p>
            <p className="text-[10px] text-navy-400">{velocity.conversion.advancement_rate}%</p>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <p className="text-2xl font-bold text-emerald-600">{velocity.conversion.completed}</p>
            <p className="text-xs text-navy-500 mt-0.5">Completed</p>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <p className="text-2xl font-bold text-amber-600">{velocity.conversion.parked}</p>
            <p className="text-xs text-navy-500 mt-0.5">Parked</p>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-4">
            <p className="text-2xl font-bold text-red-500">{velocity.conversion.declined}</p>
            <p className="text-xs text-navy-500 mt-0.5">Declined</p>
            <p className="text-[10px] text-navy-400">{velocity.conversion.decline_rate}%</p>
          </div>
        </div>
      )}

      {/* --- Pipeline summary table --- */}
      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-navy-100 flex items-center justify-between print:pb-2">
          <h2 className="text-sm font-semibold text-navy-700">Pipeline Summary Table</h2>
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="text-sm border border-navy-200 rounded-lg px-3 py-1.5 bg-white text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-300 print:hidden"
          >
            <option value="">All stages ({summary.total})</option>
            {Object.entries(STAGE_BADGE).map(([key]) => {
              const count = summary.pitches.filter(p => p.current_stage === key).length
              if (count === 0) return null
              return (
                <option key={key} value={key}>
                  {key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} ({count})
                </option>
              )
            })}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 border-b border-navy-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Stage</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Lead</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Organisation</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Source</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Funding</th>
                <th className="text-left px-4 py-3 font-semibold text-navy-700">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {filteredPitches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-navy-400">
                    No pitches match this filter
                  </td>
                </tr>
              ) : (
                filteredPitches.map(p => (
                  <tr key={p.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-navy-900">{p.title}</span>
                      {p.is_confidential && (
                        <span className="ml-2 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                          Confidential
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${STAGE_BADGE[p.current_stage] || 'bg-gray-100'}`}>
                        {p.stage_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy-500">{p.lead || '-'}</td>
                    <td className="px-4 py-3 text-navy-500">{p.organisation || '-'}</td>
                    <td className="px-4 py-3 text-navy-500 capitalize">{p.source?.replace('_', ' ') || '-'}</td>
                    <td className="px-4 py-3 text-navy-500 capitalize">{p.funding_pathway?.replace('_', ' ') || '-'}</td>
                    <td className="px-4 py-3 text-navy-500">{p.submission_date || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-navy-100 text-xs text-navy-400 print:text-navy-600">
          Showing {filteredPitches.length} of {summary.total} pitches
          {stageFilter && ` — filtered by ${stageFilter.replace('_', ' ')}`}
        </div>
      </div>
    </Layout>
  )
}
