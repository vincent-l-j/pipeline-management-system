/**
 * Shared pipeline stage configuration — used by both Kanban and list views.
 */

/**
 * Represents a single stage in the pipeline workflow.
 * Includes styling information for UI display.
 */
export interface PipelineStage {
  /** Unique key identifier for the stage (snake_case) */
  key: string;
  /** Human-readable label for the stage */
  label: string;
  /** Tailwind CSS class for the primary color (used in badges/headers) */
  color: string;
  /** Tailwind CSS class for the light background color with text color */
  lightColor: string;
}

/**
 * Ordered list of all pipeline stages.
 * Used for display in Kanban boards and list views.
 */
export const PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    key: "received",
    label: "Received",
    color: "bg-blue-500",
    lightColor: "bg-blue-100 text-blue-700",
  },
  {
    key: "initial_screen",
    label: "Initial Screen",
    color: "bg-sky-500",
    lightColor: "bg-sky-100 text-sky-700",
  },
  {
    key: "discovery_meeting",
    label: "Discovery Meeting",
    color: "bg-cyan-500",
    lightColor: "bg-cyan-100 text-cyan-700",
  },
  {
    key: "deep_assessment",
    label: "Deep Assessment",
    color: "bg-teal-500",
    lightColor: "bg-teal-100 text-teal-700",
  },
  {
    key: "due_diligence",
    label: "Due Diligence",
    color: "bg-amber-500",
    lightColor: "bg-amber-100 text-amber-700",
  },
  {
    key: "decision_pending",
    label: "Decision Pending",
    color: "bg-orange-500",
    lightColor: "bg-orange-100 text-orange-700",
  },
  {
    key: "active_support",
    label: "Active Support",
    color: "bg-green-500",
    lightColor: "bg-green-100 text-green-700",
  },
  {
    key: "parked",
    label: "Parked",
    color: "bg-gray-400",
    lightColor: "bg-gray-100 text-gray-600",
  },
  {
    key: "declined",
    label: "Declined",
    color: "bg-red-500",
    lightColor: "bg-red-100 text-red-700",
  },
  {
    key: "completed",
    label: "Completed",
    color: "bg-emerald-500",
    lightColor: "bg-emerald-100 text-emerald-700",
  },
] as const;

/**
 * Map of stage keys to stage objects for efficient O(1) lookup.
 */
export const STAGE_MAP: Record<string, PipelineStage> = Object.fromEntries(
  PIPELINE_STAGES.map((s: PipelineStage) => [s.key, s]),
);

/**
 * Labels for pitch source options.
 * Maps source keys to display labels.
 */
export const SOURCE_LABELS: Record<string, string> = {
  referral: "Referral",
  website: "Website",
  event: "Event",
  cold_outreach: "Cold Outreach",
  internal: "Internal",
  riac: "RIAC",
  foundry: "Foundry",
  board: "Board",
  riac_student: "RIAC Student",
} as const;

/**
 * Domain vocabulary offered by the pitch forms and the pipeline filter.
 * Stored on a pitch as a comma-separated free-text string, so retiring a value
 * here leaves existing pitches tagged with it untouched.
 */
export const DOMAIN_OPTIONS: readonly string[] = [
  "AI",
  "Energy Transition",
  "Digital Finance",
  "Critical Minerals",
  "Semiconductors",
  "Health",
  "Innovation system",
  "Other",
] as const;

/**
 * Labels for funding type options.
 * Maps funding type keys to display labels.
 */
export const FUNDING_LABELS: Record<string, string> = {
  crc_bid: "CRC Bid",
  rdti: "RDTI",
  philanthropic: "Philanthropic",
  government_grant: "Government Grant",
  private: "Private",
  other: "Other",
  no_funding_identified: "No Funding Identified",
  internal_funding: "Internal Funding",
} as const;
