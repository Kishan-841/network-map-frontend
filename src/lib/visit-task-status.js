/**
 * How a visit-plan task's live status looks (spec 2026-10-07 §3). The API
 * computes the status; this only labels and colours it. `dot` is a small
 * status dot, `chip` a filled pill.
 */
export const TASK_STATUS = {
  VISITED: { label: 'Visited', dot: 'bg-ok', chip: 'bg-ok-tint text-ok' },
  VISITED_OUTSIDE: { label: 'Visited outside time', dot: 'bg-warn', chip: 'bg-warn-tint text-warn' },
  DUE_NOW: { label: 'Due now', dot: 'bg-fiber', chip: 'bg-fiber-tint text-fiber' },
  UPCOMING: { label: 'Upcoming', dot: 'bg-faint', chip: 'bg-paper text-muted' },
  OVERDUE: { label: 'Overdue', dot: 'bg-bad', chip: 'bg-bad-tint text-bad' },
  // Not a task: a visit that matched nothing planned that day (planner calendar).
  OFF_PLAN: { label: 'Off-plan visit', dot: 'bg-info', chip: 'border border-dashed border-line bg-card text-muted' },
}

/** "09:30–11:00", or "Any time" for an all-day task. */
export const windowLabel = (t) => (t.startTime ? `${t.startTime}–${t.endTime}` : 'Any time')

/** A timestamp as an Indian clock time, whatever the device zone. */
export const istTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })

/** "Visited 09:52 · 38 min" — or "· on site" while the visit is still open. */
export function visitedLabel(visit) {
  // A team leader's check-in that listed this executive counts as their visit.
  const who = visit.viaCompanion && visit.byName ? ` with ${visit.byName}` : ''
  const at = `Visited${who} ${istTime(visit.visitedAt)}`
  if (!visit.checkOutAt) return `${at} · on site`
  const mins = Math.max(0, Math.round((new Date(visit.checkOutAt) - new Date(visit.visitedAt)) / 60000))
  const h = Math.floor(mins / 60)
  return `${at} · ${h ? `${h} h ${mins % 60} min` : `${mins} min`}`
}

/** A 'YYYY-MM-DD' day for people: "Wed, 7 Oct". `opts` adds e.g. the year. */
export const dayLabel = (day, opts = {}) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...opts,
  })

/**
 * One day at a glance: "6 planned · 4 visited (1 outside window) · 1 overdue
 * · 1 due now · 1 upcoming · 2 off-plan". Visited includes visits outside the
 * window; counts of zero are left out (except "planned").
 */
export function daySummary(tasks = [], offPlan = []) {
  const n = (s) => tasks.filter((t) => t.status === s).length
  const outside = n('VISITED_OUTSIDE')
  const visited = n('VISITED') + outside
  const parts = [`${tasks.length} planned`]
  if (visited) parts.push(`${visited} visited${outside ? ` (${outside} outside window)` : ''}`)
  if (n('OVERDUE')) parts.push(`${n('OVERDUE')} overdue`)
  if (n('DUE_NOW')) parts.push(`${n('DUE_NOW')} due now`)
  if (n('UPCOMING')) parts.push(`${n('UPCOMING')} upcoming`)
  if (offPlan.length) parts.push(`${offPlan.length} off-plan`)
  return parts.join(' · ')
}
