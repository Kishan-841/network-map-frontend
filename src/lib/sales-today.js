/**
 * The four "today" cards on the Assign buildings page, from
 * GET /sales/tasks/today-summary (spec 2026-11-24-sales-today-cards).
 * `summary.user` is set when the page is filtered to one person.
 */
const n = (v) => Number(v ?? 0).toLocaleString('en-IN')

const istTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })

export function todayCards(summary) {
  const { planned, done, held, checkedIn, users, user } = summary
  const checkedInCard = user
    ? user.firstCheckInAt
      ? { value: 'Checked in', sub: `at ${istTime(user.firstCheckInAt)}` }
      : { value: 'Not yet', sub: 'no check-in today' }
    : { value: `${n(checkedIn)} / ${n(users)}`, sub: 'checked in today' }
  return [
    { key: 'planned', label: 'Planned today', value: n(planned), sub: 'from the visit plan' },
    planned
      ? { key: 'done', label: 'Done', value: `${n(done)} / ${n(planned)}`, sub: 'visited' }
      : { key: 'done', label: 'Done', value: '0', sub: 'nothing planned' },
    { key: 'held', label: 'Held', value: n(held), sub: 'buildings' },
    { key: 'checkedIn', label: 'Checked in', ...checkedInCard },
  ]
}
