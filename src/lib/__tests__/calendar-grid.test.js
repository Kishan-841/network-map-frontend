import { describe, it, expect } from 'vitest'
import { monthGrid, shiftMonth, weekDays, todayIst } from '../calendar-grid'

describe('calendar grid', () => {
  it('lays a month out Mon–Sun, padded with neighbouring days', () => {
    const g = monthGrid('2026-11') // 1 Nov 2026 is a Sunday
    expect(g[0]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(g.at(-1).at(-1) >= '2026-11-30').toBe(true)
    expect(g.every((w) => w.length === 7)).toBe(true)
  })
  it('finds the week of a day and shifts months across years', () => {
    expect(weekDays('2026-11-05')[0]).toBe('2026-11-02')
    expect(weekDays('2026-11-08')).toHaveLength(7)
    expect(weekDays('2026-11-08')[6]).toBe('2026-11-08') // a Sunday ends its own week
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
  it('reads today in India, not the device zone', () => {
    // 20:00 UTC on 6 Oct is 01:30 on 7 Oct in India.
    const real = Date.now
    Date.now = () => Date.parse('2026-10-06T20:00:00Z')
    try {
      expect(todayIst()).toBe('2026-10-07')
    } finally {
      Date.now = real
    }
  })
})
