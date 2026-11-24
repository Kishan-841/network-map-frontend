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
  if (visit && !visit.checkOutAt && (status === 'VISITED' || status === 'VISITED_OUTSIDE')) {
    const parts = [status === 'VISITED_OUTSIDE' && 'outside planned time', visit.viaCompanion && `with ${visit.byName}`].filter(Boolean)
    return { label: `Visiting since ${istTime(visit.visitedAt)}`, detail: parts.join(' · ') || null, tone: 'warn' }
  }
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

/**
 * A date input's value worth fetching: a whole YYYY-MM-DD from 2000 on. Chrome sends ''
 * when a segment is cleared and 0002-…, 0020-… while a year is typed — those are ignored.
 */
export const committedDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && value >= '2000-01-01' ? value : null

/** The fetched summary, only if it answers these filters (`date|userId`) — never another day's or person's. */
export const shownSummary = (result, filterKey) => (result.summary && result.filterKey === filterKey ? result.summary : null)

/** visited = checked in and out; visiting = checked in, not out yet; not_visited = no visit (due / upcoming / missed). */
export function rowPhase({ status, visit }) {
  if (!visit || (status !== 'VISITED' && status !== 'VISITED_OUTSIDE')) return 'not_visited'
  return visit.checkOutAt ? 'visited' : 'visiting'
}

const byName = (a, b) => a.name.localeCompare(b.name)

/** The operators, zones and cities present in a day's rows (from each building's zone). */
export function filterOptions(rows) {
  const operators = new Map()
  const zones = new Map()
  const cities = new Set()
  for (const { building } of rows) {
    const z = building.zone
    if (!z) continue
    zones.set(z.id, { id: z.id, name: z.name })
    if (z.city) cities.add(z.city)
    if (z.operator) operators.set(z.operator.id, { id: z.operator.id, name: z.operator.name })
  }
  return {
    operators: [...operators.values()].sort(byName),
    zones: [...zones.values()].sort(byName),
    cities: [...cities].sort((a, b) => a.localeCompare(b)),
  }
}

/** Rows matching every set filter; a building with no zone only passes when no place filter is set. */
export function filterRows(rows, { operatorId, zoneId, city, phase } = {}) {
  return rows.filter((r) => {
    const z = r.building.zone
    if (operatorId && z?.operator?.id !== operatorId) return false
    if (zoneId && z?.id !== zoneId) return false
    if (city && z?.city !== city) return false
    if (phase && rowPhase(r) !== phase) return false
    return true
  })
}

/** Planned / Done (visited + visiting — the backend's rule) / Not visited over the rows shown. */
export function countsOf(rows) {
  const done = rows.filter((r) => rowPhase(r) !== 'not_visited').length
  return { planned: rows.length, done, notVisited: rows.length - done }
}

/** Who checked in: checked-in first (earliest first), then the rest by name; `time` is IST HH:MM or null. */
export function peopleList(people) {
  return [...people]
    .sort((a, b) => {
      if (a.firstCheckInAt && b.firstCheckInAt) return new Date(a.firstCheckInAt) - new Date(b.firstCheckInAt)
      if (a.firstCheckInAt || b.firstCheckInAt) return a.firstCheckInAt ? -1 : 1
      return byName(a, b)
    })
    .map((p) => ({ ...p, time: p.firstCheckInAt ? istTime(p.firstCheckInAt) : null }))
}

// The day plan's filters live in the address (?date=&user=&op=&zone=&city=&status=), so Back from a visit
// returns to the same day and filters. Defaults (today, everyone, all) are left out.
const PARAM = { date: 'date', userId: 'user', operatorId: 'op', zoneId: 'zone', city: 'city', phase: 'status' }
const PHASES = ['visited', 'visiting', 'not_visited']

export function planQuery(state, today) {
  const q = new URLSearchParams()
  for (const [k, p] of Object.entries(PARAM)) {
    const v = state[k]
    if (v && !(k === 'date' && v === today)) q.set(p, v)
  }
  return q.toString()
}

export function readPlanQuery(params, today) {
  const get = (k) => params.get(PARAM[k]) ?? ''
  return {
    date: committedDate(get('date')) ?? today,
    userId: get('userId'),
    operatorId: get('operatorId'),
    zoneId: get('zoneId'),
    city: get('city'),
    phase: PHASES.includes(get('phase')) ? get('phase') : '',
  }
}
