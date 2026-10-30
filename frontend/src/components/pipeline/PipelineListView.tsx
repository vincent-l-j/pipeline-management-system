/**
 * Table/list view of the pipeline — an alternative to the Kanban board.
 * Shows all pitches in a sortable, filterable table.
 * Given onStageChange, each row's stage is a native select: the touchscreen
 * path to a stage change, where the board's drag and right-click don't exist.
 */

import {
  PIPELINE_STAGES,
  STAGE_MAP,
  SOURCE_LABELS,
  FUNDING_LABELS,
} from "./PipelineConfig";
import { DECLINE_REASON_LABELS } from "../assessments/AssessmentConfig";
import type { Pitch } from "../../types";
import TableScroll from "../ui/TableScroll";

interface PipelineListViewProps {
  pitches: Pitch[];
  onStageChange?: (pitchId: string, fromStage: string, toStage: string) => void;
}

export default function PipelineListView({
  pitches,
  onStageChange,
}: PipelineListViewProps) {
  return (
    <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
      <TableScroll>
        <table className="w-full text-sm">
          <thead className="bg-navy-50 border-b border-navy-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-navy-700">
                Title
              </th>
              <th className="text-left px-4 py-3 font-semibold text-navy-700">
                Stage
              </th>
              <th className="text-left px-4 py-3 font-semibold text-navy-700">
                Source
              </th>
              <th className="text-left px-4 py-3 font-semibold text-navy-700">
                Funding
              </th>
              <th className="text-left px-4 py-3 font-semibold text-navy-700">
                Domain
              </th>
              <th className="text-left px-4 py-3 font-semibold text-navy-700">
                Submitted
              </th>
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
                const stage = STAGE_MAP[pitch.current_stage];
                return (
                  <tr
                    key={pitch.id}
                    className="hover:bg-navy-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-navy-900">
                        {pitch.title}
                      </span>
                      {pitch.is_confidential && (
                        <span className="ml-2 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                          Confidential
                        </span>
                      )}
                      {pitch.short_description && (
                        <p className="text-xs text-navy-400 mt-0.5 line-clamp-1">
                          {pitch.short_description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {onStageChange ? (
                        <select
                          aria-label={`Stage of ${pitch.title}`}
                          value={pitch.current_stage}
                          onChange={(e) => {
                            onStageChange(
                              pitch.id,
                              pitch.current_stage,
                              e.target.value,
                            );
                          }}
                          className={`min-h-11 md:min-h-0 text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy-300 ${stage.lightColor}`}
                        >
                          {PIPELINE_STAGES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${stage.lightColor}`}
                        >
                          {stage.label}
                        </span>
                      )}
                      {/* Under the badge rather than in a column of its own, which
                        would be empty on every row that is not declined. */}
                      {pitch.decline_reason && (
                        <p className="text-[11px] text-red-600 mt-1">
                          {DECLINE_REASON_LABELS[pitch.decline_reason] ??
                            pitch.decline_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-navy-500">
                      {pitch.source
                        ? (SOURCE_LABELS[pitch.source] ?? pitch.source)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-navy-500">
                      {pitch.funding_pathway
                        ? (FUNDING_LABELS[pitch.funding_pathway] ??
                          pitch.funding_pathway)
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {pitch.domain_tags ? (
                          pitch.domain_tags.split(",").map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded capitalize"
                            >
                              {tag.trim()}
                            </span>
                          ))
                        ) : (
                          <span className="text-navy-300">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-navy-500">
                      {pitch.submission_date ?? "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
