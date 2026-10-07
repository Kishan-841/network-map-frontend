import { describe, it, expect } from 'vitest'
import { daySummary, visitedLabel } from '../visit-task-status'

const t = (status) => ({ status })

describe('daySummary', () => {
  it('counts every status, visited including outside the window', () => {
    const tasks = [t('VISITED'), t('VISITED'), t('VISITED'), t('VISITED_OUTSIDE'), t('OVERDUE'), t('UPCOMING')]
    expect(daySummary(tasks, [{}, {}])).toBe('6 planned · 4 visited (1 outside window) · 1 overdue · 1 upcoming · 2 off-plan')
  })
  it('shows due now on its own and leaves out zero counts', () => {
    expect(daySummary([t('DUE_NOW'), t('UPCOMING')])).toBe('2 planned · 1 due now · 1 upcoming')
    expect(daySummary([t('VISITED')])).toBe('1 planned · 1 visited')
  })
  it('still says nothing was planned when only off-plan visits happened', () => {
    expect(daySummary([], [{}])).toBe('0 planned · 1 off-plan')
    expect(daySummary()).toBe('0 planned')
  })
})

describe('visitedLabel', () => {
  // 04:53 UTC = 10:23 IST
  const own = { visitedAt: '2026-10-07T04:53:00Z', checkOutAt: '2026-10-07T05:31:00Z' }
  it('own visit: time in IST and the time on site', () => {
    expect(visitedLabel(own)).toBe('Visited 10:23 am · 38 min')
  })
  it('a visit made with the team leader names them', () => {
    expect(visitedLabel({ ...own, viaCompanion: true, byName: 'Ravi' })).toBe('Visited with Ravi 10:23 am · 38 min')
  })
  it('still on site', () => {
    expect(visitedLabel({ ...own, checkOutAt: null, viaCompanion: true, byName: 'Ravi' })).toBe('Visited with Ravi 10:23 am · on site')
  })
})
