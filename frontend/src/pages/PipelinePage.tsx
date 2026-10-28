/**
 * Pipeline page — the main view for managing pitches through stages.
 * Toggle between Kanban board and list view. Filter and sort pitches.
 * Drag cards between columns to move pitches through the pipeline.
 * Pitches closed long ago are left off unless the URL asks for them.
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import KanbanBoard from "../components/pipeline/KanbanBoard";
import PipelineListView from "../components/pipeline/PipelineListView";
import PipelineFilters, {
  PipelineFiltersState,
} from "../components/pipeline/PipelineFilters";
import {
  CLOSED_PITCH_HIDE_AFTER_DAYS,
  isLongClosed,
} from "../components/pipeline/closedPitches";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import { Pitch, User } from "../types";

const REQUEST_TIMEOUT_MS = 15_000;

export default function PipelinePage(): React.JSX.Element {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "assessor";
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const showClosed = searchParams.get("closed") === "show";
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filters, setFilters] = useState<PipelineFiltersState>({
    sort: "newest",
  });

  const load = useCallback((): void => {
    setLoading(true);
    setFailed(false);
    Promise.all([
      api.get<Pitch[]>("/pitches", { timeout: REQUEST_TIMEOUT_MS }),
      api.get<User[]>("/users/directory", { timeout: REQUEST_TIMEOUT_MS }),
    ])
      .then(([pitchRes, userRes]) => {
        setPitches(pitchRes.data);
        setUsers(userRes.data);
        setLoading(false);
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  // The board ignores the stage API's response, so the entry time is set here:
  // a moved pitch has just entered its stage and mustn't vanish as long-closed.
  const handlePitchMoved = useCallback(
    (pitchId: string, newStage: string): void => {
      const now = new Date().toISOString();
      setPitches((prev) =>
        prev.map((p) =>
          p.id === pitchId
            ? { ...p, current_stage: newStage, stage_entered_at: now }
            : p,
        ),
      );
    },
    [],
  );

  const now = new Date();
  const hiddenCount = pitches.filter((p) =>
    isLongClosed(p, now, CLOSED_PITCH_HIDE_AFTER_DAYS),
  ).length;
  const shownPitches = showClosed
    ? pitches
    : pitches.filter(
        (p) => !isLongClosed(p, now, CLOSED_PITCH_HIDE_AFTER_DAYS),
      );

  function toggleClosed(): void {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (showClosed) next.delete("closed");
      else next.set("closed", "show");
      return next;
    });
  }

  function getFilteredPitches(): Pitch[] {
    let result = [...shownPitches];

    if (filters.stage) {
      result = result.filter((p) => p.current_stage === filters.stage);
    }
    if (filters.source) {
      result = result.filter((p) => p.source === filters.source);
    }
    if (filters.domain) {
      result = result.filter((p) =>
        p.domain_tags
          ?.toLowerCase()
          .includes(filters.domain?.toLowerCase() ?? ""),
      );
    }
    if (filters.lead_id) {
      result = result.filter((p) => p.lead_id === filters.lead_id);
    }

    switch (filters.sort) {
      case "oldest":
        result.sort((a, b) =>
          (a.submission_date ?? "").localeCompare(b.submission_date ?? ""),
        );
        break;
      case "title_asc":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title_desc":
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "newest":
      default:
        result.sort((a, b) =>
          (b.submission_date ?? "").localeCompare(a.submission_date ?? ""),
        );
        break;
    }

    return result;
  }

  const filteredPitches = getFilteredPitches();

  return (
    <Layout>
      <PageHeader
        title="Pipeline"
        description={`${String(shownPitches.length)} initiatives in the pipeline`}
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
                onClick={() => {
                  setView("kanban");
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === "kanban"
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-navy-500 hover:text-navy-700"
                }`}
              >
                Board
              </button>
              <button
                onClick={() => {
                  setView("list");
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === "list"
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-navy-500 hover:text-navy-700"
                }`}
              >
                List
              </button>
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <PipelineFilters
            filters={filters}
            onChange={setFilters}
            users={users}
          />
        </div>
        {(hiddenCount > 0 || showClosed) && (
          <button
            type="button"
            aria-pressed={showClosed}
            onClick={toggleClosed}
            className="mb-5 text-sm border border-navy-200 rounded-lg px-3 py-2 bg-white text-navy-700 hover:border-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-300"
          >
            {showClosed
              ? `Hide closed over ${String(CLOSED_PITCH_HIDE_AFTER_DAYS)} days`
              : `Show ${String(hiddenCount)} hidden`}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-navy-400">Loading pipeline...</p>
      ) : failed ? (
        <div className="bg-white rounded-xl border border-navy-100 p-6 text-center">
          <p className="text-navy-700 mb-3">
            We couldn&apos;t load the pipeline.
          </p>
          <button
            type="button"
            onClick={load}
            className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-800 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : view === "kanban" ? (
        <KanbanBoard
          pitches={filteredPitches}
          onPitchMoved={handlePitchMoved}
        />
      ) : (
        <PipelineListView pitches={filteredPitches} />
      )}
    </Layout>
  );
}
