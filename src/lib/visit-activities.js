/**
 * Kinds of field work a sales visit can log, in chip order (mirrors the API's
 * `ActivityType`). LIFT is stored for "Leafleting".
 */
export const VISIT_ACTIVITIES = [
  { type: 'DESK', label: 'Desk' },
  { type: 'UMBRELLA', label: 'Umbrella' },
  { type: 'LIFT', label: 'Leafleting' },
  { type: 'KITE', label: 'Kite activity' },
  { type: 'NOTICE_BOARD', label: 'Notice board' },
]

/** type → label, e.g. ACTIVITY_LABEL.NOTICE_BOARD === 'Notice board'. */
export const ACTIVITY_LABEL = Object.fromEntries(VISIT_ACTIVITIES.map((a) => [a.type, a.label]))
