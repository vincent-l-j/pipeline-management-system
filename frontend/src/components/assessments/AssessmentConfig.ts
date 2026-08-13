/**
 * Shared configuration for assessment criteria, scores, and recommendations.
 */

export interface Criterion {
  key: string;
  label: string;
  description: string;
}

export const CRITERIA: Criterion[] = [
  {
    key: "national_impact",
    label: "National Impact Potential",
    description: "Scale and significance of impact for Australia",
  },
  {
    key: "translation_readiness",
    label: "Translation Readiness",
    description: "How close from idea to real-world application",
  },
  {
    key: "team_capability",
    label: "Team Capability",
    description: "Track record, expertise, and execution capacity",
  },
  {
    key: "ecosystem_fit",
    label: "Ecosystem Fit",
    description: "Alignment with Rozetta's network and existing initiatives",
  },
  {
    key: "funding_pathway_clarity",
    label: "Funding Pathway Clarity",
    description: "Is there a realistic and identified funding route",
  },
  {
    key: "masterplan_alignment",
    label: "Masterplan Alignment",
    description: "Fit with Rozetta's strategic research agenda",
  },
];

export const SCORE_LABELS: Record<number, string> = {
  1: "Very Low",
  2: "Low",
  3: "Moderate",
  4: "High",
  5: "Very High",
};

export interface RecommendationOption {
  value: string;
  label: string;
  color: string;
}

export const RECOMMENDATION_OPTIONS: RecommendationOption[] = [
  {
    value: "proceed",
    label: "Proceed",
    color: "bg-green-100 text-green-700 border-green-200",
  },
  {
    value: "park",
    label: "Park",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    value: "decline",
    label: "Decline",
    color: "bg-red-100 text-red-700 border-red-200",
  },
];

/**
 * Why a pitch was declined. Mirrors DeclineReason in
 * backend/app/models/assessment.py — extend both together, plus the Alembic enum.
 *
 * Only offered alongside a Decline recommendation: the backend rejects a reason
 * sent with any other recommendation.
 */
export const DECLINE_REASON_LABELS: Record<string, string> = {
  not_strategic_priority: "Not a strategic priority",
  insufficient_scale: "Insufficient scale",
  insufficient_capacity_capability: "Insufficient capacity or capability",
  grant_funding_rejected: "Grant funding rejected",
  lack_of_rozetta_capacity: "Lack of Rozetta capacity",
  other: "Other",
} as const;

/** Options for the reason select, derived from the labels above. */
export const DECLINE_REASON_OPTIONS: readonly {
  value: string;
  label: string;
}[] = Object.entries(DECLINE_REASON_LABELS).map(([value, label]) => ({
  value,
  label,
}));
