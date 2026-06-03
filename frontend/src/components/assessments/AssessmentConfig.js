/**
 * Shared configuration for assessment criteria, scores, and recommendations.
 */

export const CRITERIA = [
  {
    key: 'national_impact',
    label: 'National Impact Potential',
    description: 'Scale and significance of impact for Australia',
  },
  {
    key: 'translation_readiness',
    label: 'Translation Readiness',
    description: 'How close from idea to real-world application',
  },
  {
    key: 'team_capability',
    label: 'Team Capability',
    description: 'Track record, expertise, and execution capacity',
  },
  {
    key: 'ecosystem_fit',
    label: 'Ecosystem Fit',
    description: 'Alignment with Rozetta\'s network and existing initiatives',
  },
  {
    key: 'funding_pathway_clarity',
    label: 'Funding Pathway Clarity',
    description: 'Is there a realistic and identified funding route',
  },
  {
    key: 'masterplan_alignment',
    label: 'Masterplan Alignment',
    description: 'Fit with Rozetta\'s strategic research agenda',
  },
]

export const SCORE_LABELS = {
  1: 'Very Low',
  2: 'Low',
  3: 'Moderate',
  4: 'High',
  5: 'Very High',
}

export const RECOMMENDATION_OPTIONS = [
  { value: 'proceed', label: 'Proceed', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'park', label: 'Park', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'decline', label: 'Decline', color: 'bg-red-100 text-red-700 border-red-200' },
]
