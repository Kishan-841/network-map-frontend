import { describe, it, expect } from 'vitest'
import { buildingMarkerShape, buildingPin, buildingPinCached } from '@/lib/map-markers'

describe('building marker shape', () => {
  it('a society permission building gets the shield; everything else the teardrop', () => {
    expect(buildingMarkerShape({ source: 'PERMISSION' })).toBe('society')
    expect(buildingMarkerShape({ source: 'COVERAGE' })).toBe('pin')
    expect(buildingMarkerShape({})).toBe('pin')
    expect(buildingMarkerShape(null)).toBe('pin')
  })
  it('draws a different outline for the society shape, same colour', () => {
    const pin = buildingPin({ color: '#22c55e' })
    const shield = buildingPin({ color: '#22c55e', shape: 'society' })
    expect(shield.svg).not.toBe(pin.svg)
    expect(shield.svg).toContain('fill="#22c55e"')
    expect(shield.svg).toContain('data-shape="society"')
    expect(pin.svg).not.toContain('data-shape="society"')
    // Same size and anchor, so both sit on the map the same way.
    expect([shield.width, shield.height, shield.anchorX, shield.anchorY]).toEqual([
      pin.width,
      pin.height,
      pin.anchorX,
      pin.anchorY,
    ])
  })
  it('caches per colour, selection AND shape', () => {
    const a = buildingPinCached({ color: '#ef4444' })
    const b = buildingPinCached({ color: '#ef4444', shape: 'society' })
    expect(a.url).not.toBe(b.url)
    expect(buildingPinCached({ color: '#ef4444', shape: 'society' })).toBe(b)
  })
})
