import { describe, it, expect } from 'vitest'
import { typedMarkerIcon, markerLabel } from '../markers.js'

describe('typedMarkerIcon', () => {
  it('returns the same cached object for the same args', () => {
    const a = typedMarkerIcon('POP', { selected: false, size: 18 })
    const b = typedMarkerIcon('POP', { selected: false, size: 18 })
    expect(a).toBe(b)
  })

  it('returns different URLs for different kinds', () => {
    const pop = typedMarkerIcon('POP')
    const closure = typedMarkerIcon('CLOSURE')
    const splitter = typedMarkerIcon('SPLITTER')
    const waypoint = typedMarkerIcon('WAYPOINT')
    const snapRing = typedMarkerIcon('SNAP_RING')
    const urls = [pop.url, closure.url, splitter.url, waypoint.url, snapRing.url]
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('produces a data URI SVG', () => {
    const { url } = typedMarkerIcon('POP')
    expect(url.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('selected icons are larger than unselected ones', () => {
    const unselected = typedMarkerIcon('CLOSURE', { selected: false, size: 18 })
    const selected = typedMarkerIcon('CLOSURE', { selected: true, size: 18 })
    expect(selected.size).toBeGreaterThan(unselected.size)
  })

  it('returns a centre anchor', () => {
    const icon = typedMarkerIcon('SPLITTER', { size: 20 })
    expect(icon.anchor).toEqual({ x: icon.size / 2, y: icon.size / 2 })
  })

  it('throws for an unknown kind', () => {
    expect(() => typedMarkerIcon('BOGUS')).toThrow('Unknown marker kind: BOGUS')
  })
})

describe('markerLabel', () => {
  it('returns the expected label object', () => {
    expect(markerLabel('CL-0001')).toEqual({
      text: 'CL-0001',
      color: '#ffffff',
      fontSize: '11px',
      fontWeight: '700',
      className: 'fiber-zone-label',
    })
  })
})
