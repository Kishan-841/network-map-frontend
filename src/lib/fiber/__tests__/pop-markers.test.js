import { describe, it, expect } from 'vitest'
import { popMarkerData, popIconUrl } from '../pop-markers'

describe('popMarkerData', () => {
  it('turns a POP into a marker with its position, name and OLT count', () => {
    const [marker] = popMarkerData([
      { id: 'p1', name: 'Morya Office', latitude: 18.62, longitude: 73.768, notes: 'Server room', olts: [{}, {}] },
    ])
    expect(marker).toEqual({
      id: 'p1',
      name: 'Morya Office',
      notes: 'Server room',
      oltCount: 2,
      position: { lat: 18.62, lng: 73.768 },
    })
  })

  it('skips a POP whose position is not a real coordinate', () => {
    const markers = popMarkerData([
      { id: 'ok', name: 'A', latitude: 18.6, longitude: 73.7 },
      { id: 'null', name: 'B', latitude: null, longitude: 73.7 },
      { id: 'text', name: 'C', latitude: 'x', longitude: 73.7 },
      { id: 'far', name: 'D', latitude: 95, longitude: 73.7 },
    ])
    expect(markers.map((m) => m.id)).toEqual(['ok'])
  })

  it('accepts coordinates that arrive as numeric strings', () => {
    expect(popMarkerData([{ id: 'p', name: 'A', latitude: '18.6', longitude: '73.7' }])[0].position).toEqual({
      lat: 18.6,
      lng: 73.7,
    })
  })

  it('is empty, not broken, before the POPs have loaded', () => {
    expect(popMarkerData(null)).toEqual([])
    expect(popMarkerData(undefined)).toEqual([])
  })
})

describe('popIconUrl', () => {
  it('is an SVG data URL in the POP colour', () => {
    const url = popIconUrl()
    expect(url.startsWith('data:image/svg+xml;charset=UTF-8,')).toBe(true)
    expect(decodeURIComponent(url)).toContain('#7c3aed')
  })
})
