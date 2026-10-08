import { describe, it, expect } from 'vitest'
import { hiddenLayerCount, buildingGroup, countBuildingGroups } from '../map-layers'

const ALL_ON = { buildings: true, live: true, notLive: true, zones: true, pops: true }

describe('hiddenLayerCount', () => {
  it('is 0 when every layer is showing', () => {
    expect(hiddenLayerCount(ALL_ON)).toBe(0)
  })

  it('counts each layer that was switched off', () => {
    expect(hiddenLayerCount({ ...ALL_ON, pops: false, zones: false })).toBe(2)
  })

  it('counts Buildings once — Live / Not live are filters inside it', () => {
    expect(hiddenLayerCount({ ...ALL_ON, buildings: false, live: false })).toBe(1)
  })

  it('does not count a layer the map does not have (no zones drawn)', () => {
    expect(hiddenLayerCount({ ...ALL_ON, zones: undefined })).toBe(0)
  })

  it('never counts Fiber — it is off by default, not hidden by the reader', () => {
    expect(hiddenLayerCount({ ...ALL_ON, fiber: false })).toBe(0)
  })
})

describe('building groups (Live / Not live / Society permission)', () => {
  const live = { isLive: true, source: 'COVERAGE' }
  const notLive = { isLive: false, source: 'COVERAGE' }
  const society = { isLive: false, source: 'PERMISSION' }
  const liveSociety = { isLive: true, source: 'PERMISSION' }

  it('puts every society in its own group, live or not', () => {
    expect(buildingGroup(society)).toBe('society')
    expect(buildingGroup(liveSociety)).toBe('society')
    expect(buildingGroup(live)).toBe('live')
    expect(buildingGroup(notLive)).toBe('notLive')
  })

  it('counts each building once, so the three rows add up to Buildings', () => {
    expect(countBuildingGroups([live, notLive, society, liveSociety, live])).toEqual({ live: 2, notLive: 1, society: 2 })
  })

  it('counts a hidden Society row as a switched-off layer', () => {
    expect(hiddenLayerCount({ ...ALL_ON, society: false })).toBe(1)
    expect(hiddenLayerCount({ ...ALL_ON, buildings: false, society: false })).toBe(1)
  })
})
