/**
 * How a lead's status looks, in one place.
 *
 * Staff and partners read the same statuses under different names — a partner
 * is told "We called them", we say "Contacted" — but they must never be told
 * different COLOURS for the same state. The tints lived in both pages and had
 * already drifted into collisions, so they live here now.
 */

/** Pipeline order: the way a lead actually moves, not alphabetical. */
export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'CONVERTED',
  'NOT_INTERESTED',
  'UNREACHABLE',
  'DUPLICATE',
]

/**
 * Colour tracks how much attention the row still wants: the live pipeline is
 * tinted and warms as it advances, the closed states go quiet. Every status
 * gets its own appearance — two states that look alike are two states nobody
 * can tell apart at a glance, which is the whole job of this column.
 */
export const LEAD_STATUS_STYLE = {
  NEW: 'bg-fiber-tint text-fiber',
  CONTACTED: 'bg-scan-tint text-scan',
  INTERESTED: 'bg-warn-tint text-warn',
  CONVERTED: 'bg-ok-tint text-ok',
  NOT_INTERESTED: 'bg-bad-tint text-bad',
  // Closed, but for different reasons: a dead number may be worth another try,
  // a duplicate never is — so it is the quietest thing on the row.
  UNREACHABLE: 'bg-paper text-muted',
  DUPLICATE: 'bg-paper text-faint',
}

export const leadStatusClass = (status) => LEAD_STATUS_STYLE[status] ?? 'bg-paper text-muted'

/** Our own vocabulary, for the staff table. */
export const STAFF_LEAD_STATUS_LABEL = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  CONVERTED: 'Converted',
  NOT_INTERESTED: 'Not interested',
  UNREACHABLE: 'Unreachable',
  DUPLICATE: 'Duplicate',
}

/**
 * What the PARTNER reads. "NEW" means nothing to them; "Sent" does. Written
 * from their side of the handover: what we did, not what we recorded.
 */
export const PARTNER_LEAD_STATUS_LABEL = {
  NEW: 'Sent',
  CONTACTED: 'We called them',
  INTERESTED: 'Interested',
  CONVERTED: 'Signed up',
  NOT_INTERESTED: 'Not interested',
  UNREACHABLE: 'Could not reach',
  DUPLICATE: 'Already known',
}
