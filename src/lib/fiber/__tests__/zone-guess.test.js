import { describe, it, expect } from 'vitest'
import { guessZoneId } from '../zone-guess'

// A square zone and a smaller one inside a different area.
const square = [
  { latitude: 18.0, longitude: 73.0 },
  { latitude: 18.0, longitude: 74.0 },
  { latitude: 19.0, longitude: 74.0 },
  { latitude: 19.0, longitude: 73.0 },
]
const far = [
  { latitude: 25.0, longitude: 80.0 },
  { latitude: 25.0, longitude: 81.0 },
  { latitude: 26.0, longitude: 81.0 },
  { latitude: 26.0, longitude: 80.0 },
]
const ZONES = [
  { id: 'far', name: 'Far', boundary: far },
  { id: 'square', name: 'Square', boundary: square },
  { id: 'noshape', name: 'No boundary drawn', boundary: null },
]
const point = (latitude, longitude) => ({ latitude, longitude })

describe('guessZoneId', () => {
  it('finds the zone whose boundary contains the first point', () => {
    expect(guessZoneId(ZONES, [point(18.5, 73.5), point(18.6, 73.6)])).toBe('square')
  })

  it('returns null when the line starts outside every zone', () => {
    expect(guessZoneId(ZONES, [point(1, 1)])).toBeNull()
  })

  it('ignores zones that have no boundary drawn', () => {
    expect(guessZoneId([{ id: 'noshape', boundary: null }], [point(18.5, 73.5)])).toBeNull()
  })

  it('counts a point on the edge as inside, so a line drawn along a border still guesses', () => {
    expect(guessZoneId(ZONES, [point(18.0, 73.5)])).toBe('square')
  })

  it('is null, not broken, with nothing to work from', () => {
    expect(guessZoneId(ZONES, [])).toBeNull()
    expect(guessZoneId(null, [point(18.5, 73.5)])).toBeNull()
    expect(guessZoneId(ZONES, null)).toBeNull()
  })

  it('tolerates a boundary that arrived as {lat,lng} instead of {latitude,longitude}', () => {
    const zones = [{ id: 'z', boundary: [{ lat: 18, lng: 73 }, { lat: 18, lng: 74 }, { lat: 19, lng: 74 }] }]
    expect(guessZoneId(zones, [point(18.2, 73.6)])).toBe('z')
  })
})
