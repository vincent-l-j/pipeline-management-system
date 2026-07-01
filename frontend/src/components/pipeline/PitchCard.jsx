/**
 * A single pitch card displayed in the Kanban board column.
 * Shows title, source, domain tags, and confidentiality flag.
 * Click the title to open the pitch detail page.
 * Right-click (admin/assessor) opens a stage picker that reuses the board's
 * optimistic-move + stage-API path via onStageSelect.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SOURCE_LABELS, FUNDING_LABELS, PIPELINE_STAGES } from './PipelineConfig'
import { useAuth } from '../../contexts/AuthContext'

export default function PitchCard({ pitch, innerRef, draggableProps, dragHandleProps, onStageSelect }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canMoveStage = user?.role === 'admin' || user?.role === 'assessor'

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const menuRef = useRef(null)

  function handleTitleClick(e) {
    e.stopPropagation()
    navigate(`/pitches/${pitch.id}`)
  }

  function handleContextMenu(e) {
    // Viewers get the browser's native menu; only privileged roles get the app menu.
    if (!canMoveStage) return
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
    setMenuOpen(true)
  }

  function selectStage(toStage) {
    setMenuOpen(false)
    if (toStage !== pitch.current_stage && onStageSelect) {
      onStageSelect(pitch.id, pitch.current_stage, toStage)
    }
  }

  // Close on outside click or Escape while the menu is open.
  useEffect(() => {
    if (!menuOpen) return
    function onDocMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      {...dragHandleProps}
      onContextMenu={handleContextMenu}
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

      {menuOpen && (
        <div
          ref={menuRef}
          data-testid="stage-menu"
          role="menu"
          style={{ top: menuPos.y, left: menuPos.x }}
          className="fixed z-50 min-w-[180px] bg-white rounded-lg border border-navy-200 shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1 text-[10px] font-semibold text-navy-400 uppercase tracking-wide">
            Move to stage
          </p>
          {PIPELINE_STAGES.map((stage) =>
            stage.key === pitch.current_stage ? (
              <div
                key={stage.key}
                data-testid="current-stage"
                aria-disabled="true"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-navy-400 cursor-default"
              >
                <span className={`w-2 h-2 rounded-full ${stage.color}`} />
                {stage.label}
                <span className="ml-auto text-[10px]">Current</span>
              </div>
            ) : (
              <button
                key={stage.key}
                type="button"
                onClick={() => selectStage(stage.key)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-navy-700 hover:bg-navy-50 text-left"
              >
                <span className={`w-2 h-2 rounded-full ${stage.color}`} />
                {stage.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
