/**
 * A FIELD-SALES lead's progress (CustomerInquiry.status), in the sales person's
 * words, with the badge classes for each. Distinct from the partner-network
 * lead statuses in lib/lead-status.js — different pipeline, different module.
 * An unknown value reads straight back so a future status still shows something.
 */
export const LEAD_STATUSES = [
  { value: 'NOT_CONTACTED', label: 'New', badge: 'bg-paper text-muted' },
  { value: 'FOLLOW_UP', label: 'Follow-up', badge: 'bg-warn-tint text-warn' },
  { value: 'COMPLETED', label: 'Completed', badge: 'bg-ok-tint text-ok' },
  { value: 'NOT_INTERESTED', label: 'Not interested', badge: 'bg-bad-tint text-bad' },
]

const BY_VALUE = Object.fromEntries(LEAD_STATUSES.map((s) => [s.value, s]))

export const leadStatusLabel = (value) => (value == null ? '' : BY_VALUE[value]?.label ?? value)
export const leadStatusBadge = (value) => BY_VALUE[value]?.badge ?? 'bg-paper text-muted'
