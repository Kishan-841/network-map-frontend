import { describe, it, expect } from 'vitest'
import { committedDate, rowStatus, shownSummary, todayCards, windowLabel } from '../sales-today'

const team = { date: '2026-11-24', planned: 1240, done: 18, notVisited: 1222, held: 310, checkedIn: 5, users: 10, user: null }
const byKey = (cards) => Object.fromEntries(cards.map((c) => [c.key, c]))

describe('todayCards', () => {
  it('shows planned, done of planned, not visited, checked in of users — no Held', () => {
    const c = byKey(todayCards(team))
    expect(Object.keys(c)).toEqual(['planned', 'done', 'notVisited', 'checkedIn'])
    expect(c.planned).toEqual({ key: 'planned', label: 'Planned', value: '1,240', sub: 'from the visit plan' })
    expect(c.done).toEqual({ key: 'done', label: 'Done', value: '18 / 1,240', sub: 'visited' })
    expect(c.notVisited).toEqual({ key: 'notVisited', label: 'Not visited', value: '1,222', sub: 'buildings' })
    expect(c.checkedIn).toEqual({ key: 'checkedIn', label: 'Checked in', value: '5 / 10', sub: 'people checked in' })
  })

  it('says nothing is planned rather than 0 / 0', () => {
    const c = byKey(todayCards({ ...team, planned: 0, done: 0, notVisited: 0 }))
    expect(c.done).toMatchObject({ value: '0', sub: 'nothing planned' })
  })

  it("shows one person's first check-in time in IST", () => {
    const user = { id: 'u', name: 'Asha', role: 'SALES_EXECUTIVE', firstCheckInAt: '2026-11-24T04:44:00.000Z' }
    const c = byKey(todayCards({ ...team, users: 1, checkedIn: 1, user }))
    expect(c.checkedIn).toEqual({ key: 'checkedIn', label: 'Checked in', value: '10:14', sub: 'first check-in' })
  })

  it('shows Not yet for one person with no check-in that day', () => {
    const user = { id: 'u', name: 'Asha', role: 'SALES_EXECUTIVE', firstCheckInAt: null }
    const c = byKey(todayCards({ ...team, users: 1, checkedIn: 0, user }))
    expect(c.checkedIn).toMatchObject({ value: 'Not yet', sub: 'no check-in' })
  })
})

describe('rowStatus', () => {
  const visit = { visitedAt: '2026-11-24T05:12:00.000Z', byName: 'Asha', viaCompanion: false }
  it('visited in time → ok, with the IST time', () => {
    expect(rowStatus({ status: 'VISITED', visit })).toEqual({ label: 'Visited 10:42', detail: null, tone: 'ok' })
  })
  it('visited outside the window → warn', () => {
    expect(rowStatus({ status: 'VISITED_OUTSIDE', visit })).toEqual({ label: 'Visited 10:42', detail: 'outside planned time', tone: 'warn' })
  })
  it("names who checked in when it was someone else's visit", () => {
    expect(rowStatus({ status: 'VISITED', visit: { ...visit, byName: 'Ravi (TL)', viaCompanion: true } }).detail).toBe('with Ravi (TL)')
  })
  it('past and unvisited → not visited; today → due now; later → upcoming', () => {
    expect(rowStatus({ status: 'OVERDUE', visit: null })).toEqual({ label: 'Not visited', detail: null, tone: 'bad' })
    expect(rowStatus({ status: 'DUE_NOW', visit: null })).toEqual({ label: 'Due now', detail: null, tone: 'warn' })
    expect(rowStatus({ status: 'UPCOMING', visit: null })).toEqual({ label: 'Upcoming', detail: null, tone: 'muted' })
  })
})

describe('windowLabel', () => {
  it('shows the planned window, or All day', () => {
    expect(windowLabel({ startTime: '10:00', endTime: '12:00' })).toBe('10:00–12:00')
    expect(windowLabel({ startTime: null, endTime: null })).toBe('All day')
  })
})

describe('committedDate', () => {
  it('takes a whole day', () => {
    expect(committedDate('2026-10-24')).toBe('2026-10-24')
  })
  it('ignores a cleared or half-typed date instead of jumping', () => {
    expect(committedDate('')).toBeNull()
    expect(committedDate('0002-10-24')).toBeNull()
    expect(committedDate('0202-10-24')).toBeNull()
    expect(committedDate('2026-1-2')).toBeNull()
  })
})

describe('shownSummary', () => {
  const summary = { date: '2026-11-24', planned: 3 }
  it('shows the answer only for the filters it was asked for', () => {
    expect(shownSummary({ filterKey: '2026-11-24|', summary }, '2026-11-24|')).toBe(summary)
    expect(shownSummary({ filterKey: '2026-11-24|', summary }, '2026-11-24|asha')).toBeNull()
    expect(shownSummary({ filterKey: '2026-11-23|', summary }, '2026-11-24|')).toBeNull()
    expect(shownSummary({ filterKey: null, summary: null }, '2026-11-24|')).toBeNull()
  })
})
