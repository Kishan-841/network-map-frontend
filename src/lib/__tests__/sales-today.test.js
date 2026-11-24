import { describe, it, expect } from 'vitest'
import { committedDate, countsOf, filterOptions, filterRows, peopleList, planQuery, readPlanQuery, safeBack, visitLink, rowPhase, rowStatus, shownSummary, todayCards, windowLabel } from '../sales-today'

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
  const visit = { visitedAt: '2026-11-24T05:12:00.000Z', checkOutAt: '2026-11-24T05:40:00.000Z', byName: 'Asha', viaCompanion: false }
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

const zoneA = { id: 'za', name: 'Aundh', city: 'Pune', operator: { id: 'o1', name: 'Airtel' } }
const zoneB = { id: 'zb', name: 'Baner', city: 'Pune', operator: null }
const zoneC = { id: 'zc', name: 'Cidco', city: 'Aurangabad', operator: { id: 'o2', name: 'Jio' } }
const mk = (id, zone, status, visit = null) => ({ id, status, visit, building: { id: `b${id}`, buildingName: id, zone } })
const done = { id: 'v1', visitedAt: '2026-11-24T05:00:00.000Z', checkOutAt: '2026-11-24T05:30:00.000Z', byName: 'A', viaCompanion: false }
const open = { ...done, id: 'v2', checkOutAt: null }
const rows = [mk('1', zoneA, 'VISITED', done), mk('2', zoneB, 'VISITED_OUTSIDE', open), mk('3', zoneC, 'DUE_NOW'), mk('4', null, 'UPCOMING')]

describe('rowPhase', () => {
  it('visited = checked out, visiting = still checked in, else not visited', () => {
    expect(rows.map(rowPhase)).toEqual(['visited', 'visiting', 'not_visited', 'not_visited'])
  })
  it('a visiting row reads Visiting since the check-in time', () => {
    expect(rowStatus(rows[1])).toMatchObject({ label: 'Visiting since 10:30' })
  })
})

describe('filterOptions', () => {
  it('lists the operators, zones and cities present in the rows, sorted', () => {
    expect(filterOptions(rows)).toEqual({
      operators: [{ id: 'o1', name: 'Airtel' }, { id: 'o2', name: 'Jio' }],
      zones: [{ id: 'za', name: 'Aundh' }, { id: 'zb', name: 'Baner' }, { id: 'zc', name: 'Cidco' }],
      cities: ['Aurangabad', 'Pune'],
    })
  })
})

describe('filterRows', () => {
  const ids = (f) => filterRows(rows, f).map((r) => r.id)
  it('keeps everything with no filters (a building with no zone too)', () => {
    expect(ids({})).toEqual(['1', '2', '3', '4'])
  })
  it('narrows by operator, zone, city and phase together', () => {
    expect(ids({ operatorId: 'o1' })).toEqual(['1'])
    expect(ids({ zoneId: 'zb' })).toEqual(['2'])
    expect(ids({ city: 'Pune' })).toEqual(['1', '2'])
    expect(ids({ city: 'Pune', phase: 'visiting' })).toEqual(['2'])
    expect(ids({ phase: 'not_visited' })).toEqual(['3', '4'])
  })
})

describe('countsOf', () => {
  it('counts planned, done (visited + visiting) and not visited', () => {
    expect(countsOf(rows)).toEqual({ planned: 4, done: 2, notVisited: 2 })
  })
})

describe('peopleList', () => {
  it('puts people who checked in first, earliest first, then the rest by name', () => {
    const people = [
      { id: 'r', name: 'Ravi', firstCheckInAt: null },
      { id: 'b', name: 'Bina', firstCheckInAt: '2026-11-24T05:00:00.000Z' },
      { id: 'a', name: 'Asha', firstCheckInAt: null },
      { id: 'm', name: 'Madhav', firstCheckInAt: '2026-11-24T04:22:00.000Z' },
    ]
    expect(peopleList(people).map((p) => [p.id, p.time])).toEqual([['m', '09:52'], ['b', '10:30'], ['a', null], ['r', null]])
  })

  it("adds each person's planned and visited buildings for the day, and their initials", () => {
    const people = [
      { id: 'm', name: 'Madhav Jalba More', firstCheckInAt: '2026-11-24T04:22:00.000Z' },
      { id: 'a', name: 'Asha', firstCheckInAt: null },
    ]
    const dayRows = [
      { ...mk('1', null, 'VISITED', done), assignee: { id: 'm' } },
      { ...mk('2', null, 'VISITED', open), assignee: { id: 'm' } },
      { ...mk('3', null, 'DUE_NOW'), assignee: { id: 'm' } },
      { ...mk('4', null, 'UPCOMING'), assignee: { id: 'a' } },
    ]
    expect(peopleList(people, dayRows).map(({ id, planned, visited, initials }) => ({ id, planned, visited, initials }))).toEqual([
      { id: 'm', planned: 3, visited: 2, initials: 'MM' },
      { id: 'a', planned: 1, visited: 0, initials: 'A' },
    ])
  })
})

describe('plan filters in the address', () => {
  const today = '2026-11-24'
  it('writes only what differs from the default view', () => {
    expect(planQuery({ date: today, userId: '', operatorId: '', zoneId: '', city: '', phase: '' }, today)).toBe('')
    expect(planQuery({ date: '2026-10-15', userId: 'u1', operatorId: '', zoneId: 'z1', city: 'PCMC', phase: 'visited' }, today))
      .toBe('date=2026-10-15&user=u1&zone=z1&city=PCMC&status=visited')
  })
  it('reads it back, ignoring junk', () => {
    const q = new URLSearchParams('date=2026-10-15&user=u1&op=o1&status=visiting&zone=z1&city=Pune')
    expect(readPlanQuery(q, today)).toEqual({ date: '2026-10-15', userId: 'u1', operatorId: 'o1', zoneId: 'z1', city: 'Pune', phase: 'visiting' })
    expect(readPlanQuery(new URLSearchParams('date=0002-01-01&status=nope'), today))
      .toEqual({ date: today, userId: '', operatorId: '', zoneId: '', city: '', phase: '' })
  })
})

describe('visit links back to the plan', () => {
  it('carries the plan address so the visit page can return to it', () => {
    expect(visitLink('v1', '/sales?date=2026-10-15&status=visited')).toBe('/sales/visits/v1?back=%2Fsales%3Fdate%3D2026-10-15%26status%3Dvisited')
    expect(visitLink('v1', '/sales')).toBe('/sales/visits/v1?back=%2Fsales')
  })
  it('only goes back inside /sales', () => {
    expect(safeBack('/sales?date=2026-10-15')).toBe('/sales?date=2026-10-15')
    expect(safeBack('/sales')).toBe('/sales')
    expect(safeBack('https://evil.example')).toBeNull()
    expect(safeBack('//evil.example/sales')).toBeNull()
    expect(safeBack('/salesx')).toBeNull()
    expect(safeBack(null)).toBeNull()
  })
})
