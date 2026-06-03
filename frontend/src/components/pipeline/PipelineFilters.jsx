/**
 * Filter and sort controls shared between Kanban and list views.
 * Filters: stage, source, domain/sector, lead.
 * Sort: by date, title, or stage.
 */

import { PIPELINE_STAGES, SOURCE_LABELS } from './PipelineConfig'

const DOMAIN_OPTIONS = [
  'climate', 'health', 'digital', 'forestry', 'agri', 'education', 'other',
]

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'title_asc', label: 'Title A–Z' },
  { key: 'title_desc', label: 'Title Z–A' },
]

export default function PipelineFilters({ filters, onChange, users }) {
  function update(field, value) {
    onChange({ ...filters, [field]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {/* Stage filter */}
      <select
        value={filters.stage || ''}
        onChange={e => update('stage', e.target.value)}
        className="text-sm border border-navy-200 rounded-lg px-3 py-2 bg-white text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-300"
      >
        <option value="">All stages</option>
        {PIPELINE_STAGES.map(s => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>

      {/* Source filter */}
      <select
        value={filters.source || ''}
        onChange={e => update('source', e.target.value)}
        className="text-sm border border-navy-200 rounded-lg px-3 py-2 bg-white text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-300"
      >
        <option value="">All sources</option>
        {Object.entries(SOURCE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      {/* Domain filter */}
      <select
        value={filters.domain || ''}
        onChange={e => update('domain', e.target.value)}
        className="text-sm border border-navy-200 rounded-lg px-3 py-2 bg-white text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-300"
      >
        <option value="">All domains</option>
        {DOMAIN_OPTIONS.map(d => (
          <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>
        ))}
      </select>

      {/* Lead filter */}
      <select
        value={filters.lead_id || ''}
        onChange={e => update('lead_id', e.target.value)}
        className="text-sm border border-navy-200 rounded-lg px-3 py-2 bg-white text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-300"
      >
        <option value="">All leads</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.display_name}</option>
        ))}
      </select>

      {/* Sort */}
      <select
        value={filters.sort || 'newest'}
        onChange={e => update('sort', e.target.value)}
        className="text-sm border border-navy-200 rounded-lg px-3 py-2 bg-white text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-300"
      >
        {SORT_OPTIONS.map(s => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>

      {/* Clear filters */}
      {(filters.stage || filters.source || filters.domain || filters.lead_id) && (
        <button
          onClick={() => onChange({ sort: filters.sort })}
          className="text-xs text-navy-500 hover:text-navy-700 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
