/**
 * Dashboard — the main landing page for Rozetta PMS.
 *
 * Shows:
 * - Pipeline stage counts (visual cards)
 * - Velocity metrics (pitches per month, conversion rates)
 * - Recent 30-day activity stats
 * - Phase 7 financial reporting placeholder
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import api from '../services/api'

const STAGE_CONFIG = [
  { key: 'received', label: 'Received', color: 'bg-blue-500' },
  { key: 'initial_screen', label: 'Initial Screen', color: 'bg-sky-500' },
  { key: 'discovery_meeting', label: 'Discovery', color: 'bg-cyan-500' },
  { key: 'deep_assessment', label: 'Deep Assessment', color: 'bg-teal-500' },
  { key: 'due_diligence', label: 'Due Diligence', color: 'bg-amber-500' },
  { key: 'decision_pending', label: 'Decision Pending', color: 'bg-orange-500' },
  { key: 'active_support', label: 'Active Support', color: 'bg-green-500' },
  { key: 'parked', label: 'Parked', color: 'bg-gray-400' },
  { key: 'declined', label: 'Declined', color: 'bg-red-500' },
  { key: 'completed', label: 'Completed', color: 'bg-emerald-500' },
]

export default function DashboardPage() {
  const [velocity, setVelocity] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/reports/velocity')
      .then(({ data }) => {
        setVelocity(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Layout>
        <PageHeader title="Dashboard" description="Overview of the Rozetta pipeline" />
        <p className="text-navy-400">Loading dashboard...</p>
      </Layout>
    )
  }

  const { stage_counts, pitches_per_month, conversion, recent_30_days } = velocity
  const totalActive = Object.values(stage_counts).reduce((a, b) => a + b, 0)

  // Find max monthly count for bar chart scaling
  const maxMonthly = Math.max(...pitches_per_month.map(m => m.count), 1)

  return (
    <Layout>
      <PageHeader
        title="Dashboard"
        description="Overview of the Rozetta pipeline"
        action={
          <Link
            to="/reports"
            className="border border-navy-200 text-navy-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-navy-400 transition-colors"
          >
            Full Reports
          </Link>
        }
      />

      {/* --- Top stats row --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-navy-900 text-white rounded-xl p-5">
          <p className="text-sm text-navy-300">Total in Pipeline</p>
          <p className="text-3xl font-bold mt-1">{totalActive}</p>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-5">
          <p className="text-sm text-navy-500">Advanced to Assessment</p>
          <p className="text-3xl font-bold text-navy-900 mt-1">{conversion.advanced_to_assessment}</p>
          <p className="text-xs text-navy-400 mt-1">{conversion.advancement_rate}% of total</p>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-5">
          <p className="text-sm text-navy-500">Completed</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{conversion.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-navy-100 p-5">
          <p className="text-sm text-navy-500">Declined</p>
          <p className="text-3xl font-bold text-red-500 mt-1">{conversion.declined}</p>
          <p className="text-xs text-navy-400 mt-1">{conversion.decline_rate}% of total</p>
        </div>
      </div>

      {/* --- Pipeline stage breakdown --- */}
      <div className="bg-white rounded-xl border border-navy-100 p-6 mb-8">
        <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-4">Pipeline by Stage</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {STAGE_CONFIG.map(s => (
            <div key={s.key} className="flex items-center gap-3 p-3 rounded-lg bg-navy-50/50">
              <div className={`w-3 h-3 rounded-full ${s.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-lg font-bold text-navy-900">{stage_counts[s.key] || 0}</p>
                <p className="text-[10px] text-navy-500 truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* --- Pitches per month (bar chart) --- */}
        <div className="bg-white rounded-xl border border-navy-100 p-6">
          <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-4">
            Pitches Received per Month
          </h2>
          {pitches_per_month.length === 0 ? (
            <p className="text-sm text-navy-400">No data yet — pitches will appear here as they are added.</p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {pitches_per_month.map(m => {
                const height = Math.max((m.count / maxMonthly) * 100, 4)
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
                    <span className="text-xs font-semibold text-navy-900 mb-1">{m.count}</span>
                    <div
                      className="w-full bg-navy-800 rounded-t-md transition-all"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[9px] text-navy-400 mt-1.5 -rotate-45 origin-top-left whitespace-nowrap">
                      {m.month}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* --- Recent activity (30 days) --- */}
        <div className="bg-white rounded-xl border border-navy-100 p-6">
          <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wide mb-4">
            Last 30 Days
          </h2>
          <div className="space-y-4">
            {[
              { label: 'New pitches added', value: recent_30_days.pitches_added, color: 'text-blue-600' },
              { label: 'Meetings logged', value: recent_30_days.meetings_logged, color: 'text-amber-600' },
              { label: 'Assessments created', value: recent_30_days.assessments_created, color: 'text-green-600' },
              { label: 'Stage transitions', value: recent_30_days.stage_changes, color: 'text-navy-600' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-navy-600">{item.label}</span>
                <span className={`text-xl font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- Phase 7 Financial Placeholder --- */}
      <div className="bg-white rounded-xl border-2 border-dashed border-navy-200 p-8 mb-8">
        <div className="text-center mb-6">
          <span className="inline-block bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
            Coming Soon — Phase 7
          </span>
          <h2 className="text-lg font-bold text-navy-900 mt-3">Financial Reporting</h2>
          <p className="text-sm text-navy-500 mt-1">
            These modules are planned for the next phase of development
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-navy-50 rounded-xl p-5 text-center">
            <div className="w-10 h-10 bg-navy-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
              <span className="text-navy-400 text-sm font-bold">$</span>
            </div>
            <h3 className="text-sm font-semibold text-navy-700">Pipeline Financial Table</h3>
            <p className="text-xs text-navy-400 mt-1">
              Bids by status: successful, under development, declined. Financial tracking across the pipeline.
            </p>
          </div>

          <div className="bg-navy-50 rounded-xl p-5 text-center">
            <div className="w-10 h-10 bg-navy-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
              <span className="text-navy-400 text-sm font-bold">%</span>
            </div>
            <h3 className="text-sm font-semibold text-navy-700">Risk-Adjusted Income View</h3>
            <p className="text-xs text-navy-400 mt-1">
              Likely income weighted by probability of success at each pipeline stage.
            </p>
          </div>

          <div className="bg-navy-50 rounded-xl p-5 text-center">
            <div className="w-10 h-10 bg-navy-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
              <span className="text-navy-400 text-sm font-bold">i</span>
            </div>
            <h3 className="text-sm font-semibold text-navy-700">Impact Measurement View</h3>
            <p className="text-xs text-navy-400 mt-1">
              Track and report on the economic, social, and environmental impact of supported initiatives.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
