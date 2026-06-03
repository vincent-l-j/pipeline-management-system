/**
 * Shared pipeline stage configuration — used by both Kanban and list views.
 */

export const PIPELINE_STAGES = [
  { key: 'received', label: 'Received', color: 'bg-blue-500', lightColor: 'bg-blue-100 text-blue-700' },
  { key: 'initial_screen', label: 'Initial Screen', color: 'bg-sky-500', lightColor: 'bg-sky-100 text-sky-700' },
  { key: 'discovery_meeting', label: 'Discovery Meeting', color: 'bg-cyan-500', lightColor: 'bg-cyan-100 text-cyan-700' },
  { key: 'deep_assessment', label: 'Deep Assessment', color: 'bg-teal-500', lightColor: 'bg-teal-100 text-teal-700' },
  { key: 'due_diligence', label: 'Due Diligence', color: 'bg-amber-500', lightColor: 'bg-amber-100 text-amber-700' },
  { key: 'decision_pending', label: 'Decision Pending', color: 'bg-orange-500', lightColor: 'bg-orange-100 text-orange-700' },
  { key: 'active_support', label: 'Active Support', color: 'bg-green-500', lightColor: 'bg-green-100 text-green-700' },
  { key: 'parked', label: 'Parked', color: 'bg-gray-400', lightColor: 'bg-gray-100 text-gray-600' },
  { key: 'declined', label: 'Declined', color: 'bg-red-500', lightColor: 'bg-red-100 text-red-700' },
  { key: 'completed', label: 'Completed', color: 'bg-emerald-500', lightColor: 'bg-emerald-100 text-emerald-700' },
]

export const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, s]))

export const SOURCE_LABELS = {
  referral: 'Referral',
  website: 'Website',
  event: 'Event',
  cold_outreach: 'Cold Outreach',
  internal: 'Internal',
}

export const FUNDING_LABELS = {
  crc_bid: 'CRC Bid',
  rdti: 'RDTI',
  philanthropic: 'Philanthropic',
  government_grant: 'Government Grant',
  private: 'Private',
  other: 'Other',
}
