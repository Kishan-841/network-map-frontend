import { describe, it, expect } from 'vitest'
import { calendarItems } from '../plan-calendar-items'

const task = (o) => ({ id: o.id, taskDate: o.day ?? '2026-11-03', startTime: o.start ?? null, endTime: o.end ?? null,
  status: o.status ?? 'UPCOMING', building: { buildingName: o.name ?? 'B' }, visit: o.visit ?? null })
const off = (o) => ({ id: o.id, day: o.day ?? '2026-11-03', visitedAt: o.at, buildingName: o.name ?? 'Off' })

describe('calendarItems', () => {
  it('groups tasks and off-plan visits by day', () => {
    const m = calendarItems([task({ id: 't1' }), task({ id: 't2', day: '2026-11-04' })], [off({ id: 'v1', at: '2026-11-03T06:00:00Z' })])
    // any-time task t1 sorts after the 11:30 off-plan visit
    expect(m.get('2026-11-03').map((i) => i.key)).toEqual(['visit:v1', 'task:t1'])
    expect(m.get('2026-11-04').map((i) => i.key)).toEqual(['task:t2'])
  })
  it('orders a day by time: windows, then off-plan by visit time, then any-time tasks', () => {
    const m = calendarItems(
      [task({ id: 'any' }), task({ id: 'late', start: '17:00', end: '18:00' }), task({ id: 'early', start: '09:30', end: '11:00' })],
      [off({ id: 'noon', at: '2026-11-03T06:30:00Z' })], // 12:00 IST
    )
    expect(m.get('2026-11-03').map((i) => i.key)).toEqual(['task:early', 'visit:noon', 'task:late', 'task:any'])
  })
  it('labels: window or "Any time", off-plan visit time in IST, building names', () => {
    const m = calendarItems([task({ id: 'w', start: '09:30', end: '11:00', name: 'Silver Oak', status: 'VISITED' })], [off({ id: 'o', at: '2026-11-03T08:10:00Z', name: 'Lake View' })])
    const [w, o] = m.get('2026-11-03')
    expect(w).toMatchObject({ kind: 'task', time: '09:30', name: 'Silver Oak', status: 'VISITED' })
    expect(o).toMatchObject({ kind: 'offplan', time: '13:40', name: 'Lake View', status: 'OFF_PLAN', visitId: 'o' })
  })
  it('an empty plan gives an empty map', () => {
    expect(calendarItems([], []).size).toBe(0)
    expect(calendarItems(undefined, undefined).size).toBe(0)
  })
})
