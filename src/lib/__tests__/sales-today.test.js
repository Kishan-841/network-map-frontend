import { describe, it, expect } from 'vitest'
import { todayCards } from '../sales-today'

const team = { date: '2026-11-24', planned: 1240, done: 18, held: 310, checkedIn: 5, users: 10, user: null }
const byKey = (cards) => Object.fromEntries(cards.map((c) => [c.key, c]))

describe('todayCards', () => {
  it('shows the team: planned, done of planned, held, checked in of users', () => {
    const c = byKey(todayCards(team))
    expect(Object.keys(c)).toEqual(['planned', 'done', 'held', 'checkedIn'])
    expect(c.planned).toEqual({ key: 'planned', label: 'Planned today', value: '1,240', sub: 'from the visit plan' })
    expect(c.done).toEqual({ key: 'done', label: 'Done', value: '18 / 1,240', sub: 'visited' })
    expect(c.held).toEqual({ key: 'held', label: 'Held', value: '310', sub: 'buildings' })
    expect(c.checkedIn).toEqual({ key: 'checkedIn', label: 'Checked in', value: '5 / 10', sub: 'checked in today' })
  })

  it('says nothing is planned rather than 0 / 0', () => {
    const c = byKey(todayCards({ ...team, planned: 0, done: 0 }))
    expect(c.done).toMatchObject({ value: '0', sub: 'nothing planned' })
  })

  it("shows one person's first check-in time in IST", () => {
    const user = { id: 'u', name: 'Asha', role: 'SALES_EXECUTIVE', firstCheckInAt: '2026-11-24T04:44:00.000Z' }
    const c = byKey(todayCards({ ...team, users: 1, checkedIn: 1, user }))
    expect(c.checkedIn).toEqual({ key: 'checkedIn', label: 'Checked in', value: '10:14', sub: 'first check-in today' })
  })

  it('shows Not yet for one person with no check-in today', () => {
    const user = { id: 'u', name: 'Asha', role: 'SALES_EXECUTIVE', firstCheckInAt: null }
    const c = byKey(todayCards({ ...team, users: 1, checkedIn: 0, user }))
    expect(c.checkedIn).toMatchObject({ value: 'Not yet', sub: 'no check-in today' })
  })
})
