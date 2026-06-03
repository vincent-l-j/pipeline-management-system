/**
 * Visual 1-5 score selector for a single assessment criterion.
 * Shows clickable circles that fill with colour on selection.
 */

import { SCORE_LABELS } from './AssessmentConfig'

export default function ScoreSelector({ criterion, value, onChange, readOnly = false }) {
  const scores = [1, 2, 3, 4, 5]

  function getScoreColor(score) {
    if (score <= 1) return 'bg-red-500'
    if (score <= 2) return 'bg-orange-500'
    if (score <= 3) return 'bg-amber-500'
    if (score <= 4) return 'bg-teal-500'
    return 'bg-green-500'
  }

  return (
    <div className="py-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold text-navy-900">{criterion.label}</h4>
          <p className="text-xs text-navy-400">{criterion.description}</p>
        </div>
        {value && (
          <span className="text-xs font-medium text-navy-500 shrink-0 ml-4">
            {value}/5 — {SCORE_LABELS[value]}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {scores.map((score) => (
          <button
            key={score}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange(score)}
            className={`
              w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
              transition-all duration-150
              ${value >= score
                ? `${getScoreColor(score)} text-white shadow-sm`
                : readOnly
                  ? 'bg-navy-100 text-navy-300'
                  : 'bg-navy-100 text-navy-400 hover:bg-navy-200 cursor-pointer'
              }
              ${readOnly ? '' : 'cursor-pointer'}
            `}
            title={`${score} — ${SCORE_LABELS[score]}`}
          >
            {score}
          </button>
        ))}

        {/* Score bar visual */}
        <div className="flex-1 ml-2 h-2 bg-navy-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${value ? getScoreColor(value) : ''}`}
            style={{ width: value ? `${(value / 5) * 100}%` : '0%' }}
          />
        </div>
      </div>
    </div>
  )
}
