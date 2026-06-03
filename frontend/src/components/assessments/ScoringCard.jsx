/**
 * Read-only scoring card that displays a completed assessment.
 * Shows all 6 criteria scores, overall average, recommendation, and rationale.
 */

import { CRITERIA, SCORE_LABELS, RECOMMENDATION_OPTIONS } from './AssessmentConfig'
import ScoreSelector from './ScoreSelector'

export default function ScoringCard({ assessment, assessorName }) {
  const totalScore = CRITERIA.reduce((sum, c) => sum + (assessment[c.key] || 0), 0)
  const avgScore = (totalScore / CRITERIA.length).toFixed(1)
  const rec = RECOMMENDATION_OPTIONS.find(r => r.value === assessment.recommendation)

  return (
    <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-navy-50 border-b border-navy-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-navy-900">
              Assessment v{assessment.version}
            </h3>
            {rec && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${rec.color}`}>
                {rec.label}
              </span>
            )}
          </div>
          <p className="text-xs text-navy-500 mt-0.5">
            {assessorName || 'Unknown assessor'} — {assessment.assessment_date}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-navy-900">{avgScore}</p>
          <p className="text-[10px] text-navy-400 uppercase tracking-wide">Avg Score</p>
        </div>
      </div>

      {/* Scores */}
      <div className="px-6 py-2 divide-y divide-navy-50">
        {CRITERIA.map(criterion => (
          <ScoreSelector
            key={criterion.key}
            criterion={criterion}
            value={assessment[criterion.key]}
            readOnly
          />
        ))}
      </div>

      {/* Rationale */}
      {assessment.rationale && (
        <div className="px-6 py-4 border-t border-navy-100">
          <h4 className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">Rationale</h4>
          <p className="text-sm text-navy-800 whitespace-pre-wrap">{assessment.rationale}</p>
        </div>
      )}
    </div>
  )
}
