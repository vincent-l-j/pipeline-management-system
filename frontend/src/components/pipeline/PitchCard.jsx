/**
 * A single pitch card displayed in the Kanban board column.
 * Shows title, source, domain tags, and confidentiality flag.
 * Click the title to open the pitch detail page.
 */

import { useNavigate } from 'react-router-dom'
import { SOURCE_LABELS, FUNDING_LABELS } from './PipelineConfig'

export default function PitchCard({ pitch, innerRef, draggableProps, dragHandleProps }) {
  const navigate = useNavigate()

  function handleTitleClick(e) {
    e.stopPropagation()
    navigate(`/pitches/${pitch.id}`)
  }

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      {...dragHandleProps}
      className="bg-white rounded-lg border border-navy-100 p-3 mb-2 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          onClick={handleTitleClick}
          className="text-sm font-semibold text-navy-900 leading-tight hover:text-navy-600 cursor-pointer"
        >
          {pitch.title}
        </h4>
        {pitch.is_confidential && (
          <span className="shrink-0 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
            Confidential
          </span>
        )}
      </div>

      {pitch.short_description && (
        <p className="text-xs text-navy-500 mt-1 line-clamp-2">
          {pitch.short_description}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mt-2">
        {pitch.source && (
          <span className="text-[10px] bg-navy-50 text-navy-600 px-1.5 py-0.5 rounded">
            {SOURCE_LABELS[pitch.source] || pitch.source}
          </span>
        )}
        {pitch.funding_pathway && (
          <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
            {FUNDING_LABELS[pitch.funding_pathway] || pitch.funding_pathway}
          </span>
        )}
        {pitch.domain_tags && pitch.domain_tags.split(',').map((tag) => (
          <span key={tag} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded capitalize">
            {tag.trim()}
          </span>
        ))}
      </div>

      {pitch.submission_date && (
        <p className="text-[10px] text-navy-400 mt-2">
          {pitch.submission_date}
        </p>
      )}
    </div>
  )
}
