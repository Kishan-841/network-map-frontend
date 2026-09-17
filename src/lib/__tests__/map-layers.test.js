import { describe, it, expect } from 'vitest'
import { hiddenLayerCount } from '../map-layers'

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
