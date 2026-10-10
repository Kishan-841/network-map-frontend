import { describe, it, expect } from 'vitest'
import {
  managerZonesStatus,
  mayAddSurveyor,
  mayEditTeam,
  managerZoneIdsToSend,
  hiddenZoneCount,
} from '../manager-team'

const zones = [{ id: 'a' }, { id: 'b' }]

describe('managerZonesStatus', () => {
  it('tells loading, a failed load, no zones and ready apart', () => {
    expect(managerZonesStatus({ zones: null })).toBe('loading')
    expect(managerZonesStatus({ zones: undefined })).toBe('loading')
    // A failed load is NOT "no zones" — even if something set an empty list.
    expect(managerZonesStatus({ zones: [], error: 'Could not load zones' })).toBe('error')
    expect(managerZonesStatus({ zones: null, error: 'x' })).toBe('error')
    expect(managerZonesStatus({ zones: [] })).toBe('none')
    expect(managerZonesStatus({ zones })).toBe('ready')
  })
})

describe('what a manager may do per status', () => {
  it('adds only with zones, edits only once the list is known', () => {
    expect(['loading', 'error', 'none', 'ready'].map(mayAddSurveyor)).toEqual([false, false, false, true])
    expect(['loading', 'error', 'none', 'ready'].map(mayEditTeam)).toEqual([false, false, true, true])
  })
})

describe('managerZoneIdsToSend', () => {
  it('omits zones entirely while the list is not loaded — never sends []', () => {
    expect(managerZoneIdsToSend(['a', 'x'], null)).toBeUndefined()
    expect(managerZoneIdsToSend(['a', 'x'], undefined)).toBeUndefined()
  })
  it("sends only the manager's own zones (the API keeps the rest)", () => {
    expect(managerZoneIdsToSend(['a', 'x', 'b'], zones)).toEqual(['a', 'b'])
    expect(managerZoneIdsToSend([], zones)).toEqual([])
  })
})

describe('hiddenZoneCount', () => {
  it('counts zones outside the manager, and claims none while unknown', () => {
    expect(hiddenZoneCount(['a', 'x', 'y'], zones)).toBe(2)
    expect(hiddenZoneCount(['a', 'x'], null)).toBe(0)
  })
})
