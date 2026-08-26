/**
 * Shared pipeline stage configuration — used by both Kanban and list views.
 */

import type { SelectOption } from "../ui/OptionSelect";

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

/** Labels for pitch source options. */
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
  rozetta_network: "Rozetta Network",
} as const;

/**
 * Turn a label map into the option list a form field renders.
 *
 * Deriving the options means adding a backend enum value is a one-line change to
 * the label map above, and the map stays the single place the vocabulary is
 * pinned. Insertion order is preserved, so the maps also fix the display order.
 */
function optionsFrom(labels: Record<string, string>): SelectOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

/** Source options for the pitch forms, derived from {@link SOURCE_LABELS}. */
export const SOURCE_OPTIONS: readonly SelectOption[] =
  optionsFrom(SOURCE_LABELS);

/** Labels for what a pitch is asking Rozetta for. */
export const REQUEST_TYPE_LABELS: Record<string, string> = {
  advise: "Advise",
  convene: "Convene",
  sponsored_research: "Sponsored Research",
  thought_leadership: "Thought Leadership",
  catalyse: "Catalyse",
  direct_investment: "Direct Investment",
  other: "Other",
} as const;

/** Request options for the pitch forms, derived from {@link REQUEST_TYPE_LABELS}. */
export const REQUEST_TYPE_OPTIONS: readonly SelectOption[] =
  optionsFrom(REQUEST_TYPE_LABELS);

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

/** Labels for funding type options. */
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

/** Funding options for the pitch forms, derived from {@link FUNDING_LABELS}. */
export const FUNDING_OPTIONS: readonly SelectOption[] =
  optionsFrom(FUNDING_LABELS);
