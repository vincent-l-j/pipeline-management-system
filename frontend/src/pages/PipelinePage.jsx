/**
 * Pipeline page — the main view for managing pitches through stages.
 * Toggle between Kanban board and list view. Filter and sort pitches.
 * Drag cards between columns to move pitches through the pipeline.
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import PageHeader from '../components/PageHeader'
import KanbanBoard from '../components/pipeline/KanbanBoard'
import PipelineListView from '../components/pipeline/PipelineListView'
import PipelineFilters from '../components/pipeline/PipelineFilters'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

export default function PipelinePage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'assessor'
  const [pitches, setPitches] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban') // 'kanban' or 'list'
  const [filters, setFilters] = useState({ sort: 'newest' })

  // Load pitches and users on mount
  useEffect(() => {
    Promise.all([
      api.get('/pitches'),
      api.get('/users'),
    ]).then(([pitchRes, userRes]) => {
      setPitches(pitchRes.data)
      setUsers(userRes.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Handle Kanban drag — optimistically update pitch stage in local state
  const handlePitchMoved = useCallback((pitchId, newStage) => {
    setPitches(prev => prev.map(p =>
      p.id === pitchId ? { ...p, current_stage: newStage } : p
    ))
  }, [])

  // Apply filters and sorting to pitches
  function getFilteredPitches() {
    let result = [...pitches]

    if (filters.stage) {
      result = result.filter(p => p.current_stage === filters.stage)
    }
    if (filters.source) {
      result = result.filter(p => p.source === filters.source)
    }
    if (filters.domain) {
      result = result.filter(p =>
        p.domain_tags && p.domain_tags.toLowerCase().includes(filters.domain.toLowerCase())
      )
    }
    if (filters.lead_id) {
      result = result.filter(p => p.lead_id === filters.lead_id)
    }

    // Sort
    switch (filters.sort) {
      case 'oldest':
        result.sort((a, b) => (a.submission_date || '').localeCompare(b.submission_date || ''))
        break
      case 'title_asc':
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'title_desc':
        result.sort((a, b) => b.title.localeCompare(a.title))
        break
      case 'newest':
      default:
        result.sort((a, b) => (b.submission_date || '').localeCompare(a.submission_date || ''))
        break
    }

    return result
  }

  const filteredPitches = getFilteredPitches()

  return (
    <Layout>
      <PageHeader
        title="Pipeline"
        description={`${pitches.length} initiatives in the pipeline`}
        action={
          <div className="flex items-center gap-3">
            {canEdit && (
              <Link
                to="/pitches/new"
                className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
              >
                New Pitch
              </Link>
            )}
            <div className="flex items-center bg-navy-100 rounded-lg p-0.5">
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === 'kanban'
                    ? 'bg-white text-navy-900 shadow-sm'
                    : 'text-navy-500 hover:text-navy-700'
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === 'list'
                    ? 'bg-white text-navy-900 shadow-sm'
                    : 'text-navy-500 hover:text-navy-700'
                }`}
              >
                List
              </button>
            </div>
          </div>
        }
      />

      <PipelineFilters
        filters={filters}
        onChange={setFilters}
        users={users}
      />

      {loading ? (
        <p className="text-navy-400">Loading pipeline...</p>
      ) : view === 'kanban' ? (
        <KanbanBoard pitches={filteredPitches} onPitchMoved={handlePitchMoved} />
      ) : (
        <PipelineListView pitches={filteredPitches} />
      )}
    </Layout>
  )
}
