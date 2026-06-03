/**
 * Table/list view of the pipeline — an alternative to the Kanban board.
 * Shows all pitches in a sortable, filterable table.
 */

import { STAGE_MAP, SOURCE_LABELS, FUNDING_LABELS } from './PipelineConfig'

export default function PipelineListView({ pitches, onStageClick }) {
  return (
    <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-navy-50 border-b border-navy-100">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-navy-700">Title</th>
            <th className="text-left px-4 py-3 font-semibold text-navy-700">Stage</th>
            <th className="text-left px-4 py-3 font-semibold text-navy-700">Source</th>
            <th className="text-left px-4 py-3 font-semibold text-navy-700">Funding</th>
            <th className="text-left px-4 py-3 font-semibold text-navy-700">Domain</th>
            <th className="text-left px-4 py-3 font-semibold text-navy-700">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50">
          {pitches.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-navy-400">
                No pitches match your filters
              </td>
            </tr>
          ) : (
            pitches.map((pitch) => {
              const stage = STAGE_MAP[pitch.current_stage]
              return (
                <tr key={pitch.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-navy-900">{pitch.title}</span>
                    {pitch.is_confidential && (
                      <span className="ml-2 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                        Confidential
                      </span>
                    )}
                    {pitch.short_description && (
                      <p className="text-xs text-navy-400 mt-0.5 line-clamp-1">{pitch.short_description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${stage?.lightColor || 'bg-gray-100'}`}>
                      {stage?.label || pitch.current_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    {SOURCE_LABELS[pitch.source] || pitch.source || '-'}
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    {FUNDING_LABELS[pitch.funding_pathway] || pitch.funding_pathway || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {pitch.domain_tags ? pitch.domain_tags.split(',').map((tag) => (
                        <span key={tag} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded capitalize">
                          {tag.trim()}
                        </span>
                      )) : <span className="text-navy-300">-</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    {pitch.submission_date || '-'}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
