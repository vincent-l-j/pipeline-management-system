/**
 * Chronological activity timeline for a pitch.
 * Shows all events: creation, stage changes, meetings, assessments.
 * Each event has a coloured icon, timestamp, title, description, and actor.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const EVENT_CONFIG = {
  created: { color: 'bg-navy-500', icon: '+' },
  stage_change: { color: 'bg-blue-500', icon: '>' },
  meeting: { color: 'bg-amber-500', icon: 'M' },
  assessment: { color: 'bg-green-500', icon: 'A' },
}

export default function ActivityTimeline({ pitchId }) {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/pitches/${pitchId}/timeline`)
      .then(({ data }) => {
        setEvents(data.events)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [pitchId])

  function formatDate(isoDate) {
    const d = new Date(isoDate)
    return d.toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function handleClick(event) {
    if (event.type === 'meeting' && event.meeting_id) {
      navigate(`/meetings/${event.meeting_id}`)
    } else if (event.type === 'assessment' && event.assessment_id) {
      navigate(`/assessments/${event.assessment_id}`)
    }
  }

  if (loading) {
    return <p className="text-sm text-navy-400">Loading timeline...</p>
  }

  if (events.length === 0) {
    return <p className="text-sm text-navy-400">No activity recorded yet.</p>
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-navy-100" />

      <div className="space-y-0">
        {events.map((event, i) => {
          const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.created
          const clickable = event.type === 'meeting' || event.type === 'assessment'

          return (
            <div
              key={i}
              onClick={() => clickable && handleClick(event)}
              className={`relative flex gap-4 py-3 pl-1 ${clickable ? 'cursor-pointer hover:bg-navy-50/50 rounded-lg' : ''}`}
            >
              {/* Icon dot */}
              <div className={`relative z-10 w-7 h-7 rounded-full ${config.color} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                {config.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-navy-900">{event.title}</h4>
                  {clickable && (
                    <span className="text-[10px] text-navy-400">click to view</span>
                  )}
                </div>
                {event.description && (
                  <p className="text-xs text-navy-500 mt-0.5 line-clamp-2">{event.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-navy-400">{formatDate(event.date)}</span>
                  {event.actor && (
                    <span className="text-[10px] text-navy-400">by {event.actor}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
