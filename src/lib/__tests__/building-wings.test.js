import { describe, it, expect } from 'vitest'
import { wingSummary, wingFormErrors, countPartlyLive, nextWingName, wingTotals } from '@/lib/building-wings'
import { buildingColor, LIVE_COLOR, NOT_LIVE_COLOR, PARTIAL_COLOR } from '@/lib/constants'

const b = (wings, total = wings.length, isLive = false) => ({ isLive, details: { wings: total }, wings })
const w = (isLive) => ({ id: String(Math.random()), name: 'A', latitude: 1, longitude: 1, isLive })

describe('wingSummary', () => {
  it('no wings placed', () => expect(wingSummary(b([], 3))).toMatchObject({ placed: 0, total: 3, state: 'none', complete: false }))
  it('all / some / none live', () => {
    expect(wingSummary(b([w(true), w(true)])).state).toBe('all')
    expect(wingSummary(b([w(true), w(false)])).state).toBe('some')
    expect(wingSummary(b([w(false)])).state).toBe('off')
  })
  it('complete only when every wing is placed', () => {
    expect(wingSummary(b([w(true)], 2)).complete).toBe(false)
    expect(wingSummary(b([w(true), w(false)], 2)).complete).toBe(true)
  })
})

describe('buildingColor with wings', () => {
  it('green / amber / red by live wings, plain building unchanged', () => {
    expect(buildingColor(b([w(true), w(true)]))).toBe(LIVE_COLOR)
    expect(buildingColor(b([w(true), w(false)]))).toBe(PARTIAL_COLOR)
    expect(buildingColor(b([w(false)]))).toBe(NOT_LIVE_COLOR)
    expect(buildingColor({ isLive: true })).toBe(LIVE_COLOR)
  })
  it('a partly placed building keeps its own Live colour', () => {
    expect(buildingColor(b([w(true)], 3, false))).toBe(NOT_LIVE_COLOR)
    expect(buildingColor(b([w(false)], 3, true))).toBe(LIVE_COLOR)
    expect(buildingColor(b([w(true), w(false)], 3, false))).toBe(NOT_LIVE_COLOR)
  })
  it('reads the wing count from a flat wingCount too', () => {
    expect(wingSummary({ wingCount: 2, wings: [w(true), w(false)] })).toMatchObject({ total: 2, complete: true })
    expect(buildingColor({ isLive: false, wingCount: 2, wings: [w(true), w(false)] })).toBe(PARTIAL_COLOR)
  })
})

describe('wingFormErrors', () => {
  it('needs a unique name and a whole home pass', () => {
    expect(wingFormErrors({ name: ' ', homePass: '3' }, [])).toHaveProperty('name')
    expect(wingFormErrors({ name: 'a', homePass: '3' }, ['A'])).toEqual({ name: 'Another wing is already called "a"' })
    expect(wingFormErrors({ name: 'B', homePass: '-1' }, [])).toHaveProperty('homePass')
    expect(wingFormErrors({ name: 'B', homePass: '' }, [])).toHaveProperty('homePass')
    expect(wingFormErrors({ name: 'B', homePass: '12' }, ['A'])).toEqual({})
  })
})

describe('countPartlyLive', () => {
  it('counts only complete buildings with some wings live', () => {
    expect(countPartlyLive([
      b([w(true), w(false)]), // complete, some → amber
      b([w(true), w(false)], 3), // partial → not counted
      b([w(true), w(true)]), // all live
      { isLive: true },
    ])).toBe(1)
  })
})

describe('nextWingName', () => {
  it('first unused letter, case-insensitive', () => {
    expect(nextWingName([])).toBe('A')
    expect(nextWingName(['a', 'B', 'D'])).toBe('C')
  })
  it('falls back to numbers once A–Z are taken', () => {
    const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
    expect(nextWingName(letters)).toBe('1')
    expect(nextWingName([...letters, '1', '2'])).toBe('3')
  })
})

describe('wingTotals', () => {
  it('sums valid home pass and counts live', () => {
    expect(wingTotals([
      { homePass: 100, isLive: true },
      { homePass: '50', isLive: false },
      { homePass: '', isLive: true },
      { homePass: '-3', isLive: false },
    ])).toEqual({ homePass: 150, live: 2, placed: 4 })
  })
})
