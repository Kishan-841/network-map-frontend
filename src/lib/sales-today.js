/**
 * The sales page's day plan (specs 2026-11-24-sales-today-cards and -sales-day-plan):
 * the four cards and the per-row status text, from GET /sales/tasks/today-summary.
 * `summary.user` is set when the page is filtered to one person.
 */
const n = (v) => Number(v ?? 0).toLocaleString('en-IN')

const istTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })

export function todayCards(summary) {
  const { planned, done, notVisited, checkedIn, users, user } = summary
  const checkedInCard = user
    ? user.firstCheckInAt
      ? { value: istTime(user.firstCheckInAt), sub: 'first check-in' }
      : { value: 'Not yet', sub: 'no check-in' }
    : { value: `${n(checkedIn)} / ${n(users)}`, sub: 'people checked in' }
  return [
    { key: 'planned', label: 'Planned', value: n(planned), sub: 'from the visit plan' },
    planned
      ? { key: 'done', label: 'Done', value: `${n(done)} / ${n(planned)}`, sub: 'visited' }
      : { key: 'done', label: 'Done', value: '0', sub: 'nothing planned' },
    { key: 'notVisited', label: 'Not visited', value: n(notVisited), sub: 'buildings' },
    { key: 'checkedIn', label: 'Checked in', ...checkedInCard },
  ]
}

/** A plan row's status as text + tone (ok | warn | bad | muted). Status comes from the backend's matchDay. */
export function rowStatus({ status, visit }) {
  if (visit && (status === 'VISITED' || status === 'VISITED_OUTSIDE')) {
    const parts = [status === 'VISITED_OUTSIDE' && 'outside planned time', visit.viaCompanion && `with ${visit.byName}`].filter(Boolean)
    return { label: `Visited ${istTime(visit.visitedAt)}`, detail: parts.join(' · ') || null, tone: status === 'VISITED' ? 'ok' : 'warn' }
  }
  if (status === 'OVERDUE') return { label: 'Not visited', detail: null, tone: 'bad' }
  if (status === 'DUE_NOW') return { label: 'Due now', detail: null, tone: 'warn' }
  return { label: 'Upcoming', detail: null, tone: 'muted' }
}

export const windowLabel = ({ startTime, endTime }) => (startTime ? `${startTime}–${endTime}` : 'All day')

/** Today's IST day as YYYY-MM-DD (the date picker's default). */
export const istToday = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
