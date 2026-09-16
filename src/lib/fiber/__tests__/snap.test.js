import { describe, it, expect } from 'vitest'
import { findSnap, targetToType, targetToRef, SNAP_PX, SNAP_METERS } from '../snap.js'

// Fake screen projection: only latitude maps to x (matches the brief's fake), so
// pixel distance and ground distance can be varied independently via latitude
// (tiny, controls both) vs longitude (large, only affects ground distance).
const projectPixel = (t) => ({ x: t.latitude * 1000, y: 0 })
const pixel = { x: 0, y: 0 }
const latLng = { latitude: 0, longitude: 0 }

describe('findSnap', () => {
  it('returns a target within both the pixel and metre radius', () => {
    const near = { kind: 'POP', id: 1, label: 'Near', latitude: 0.0001, longitude: 0, splitter: null }
    const result = findSnap([near], { pixel, latLng, projectPixel })
    expect(result).toBe(near)
  })

  it('excludes a target within pixel radius but beyond the metre radius', () => {
    const farPixelOk = { kind: 'POP', id: 2, label: 'FarButOnScreen', latitude: 0.001, longitude: 0, splitter: null }
    expect(Math.abs(projectPixel(farPixelOk).x)).toBeLessThanOrEqual(SNAP_PX)
    const result = findSnap([farPixelOk], { pixel, latLng, projectPixel })
    expect(result).toBeNull()
  })

  it('picks the nearer of two qualifying targets', () => {
    const farther = { kind: 'CLOSURE', id: 3, label: 'Farther', latitude: 0.0002, longitude: 0, splitter: '1:8' }
    const nearer = { kind: 'CLOSURE', id: 4, label: 'Nearer', latitude: 0.00005, longitude: 0, splitter: '1:4' }
    const result = findSnap([farther, nearer], { pixel, latLng, projectPixel })
    expect(result).toBe(nearer)
  })

  it('returns null for an empty target list', () => {
    expect(findSnap([], { pixel, latLng, projectPixel })).toBeNull()
  })

  it('respects overridden radii', () => {
    const target = { kind: 'BUILDING', id: 5, label: 'B', latitude: 0.0001, longitude: 0, splitter: null }
    expect(findSnap([target], { pixel, latLng, projectPixel, meterRadius: 1 })).toBeNull()
    expect(findSnap([target], { pixel, latLng, projectPixel, pxRadius: 0.01 })).toBeNull()
  })

  it('defaults match the documented constants', () => {
    expect(SNAP_PX).toBe(14)
    expect(SNAP_METERS).toBe(25)
  })
})

describe('targetToType', () => {
  it('returns the kind', () => {
    expect(targetToType({ kind: 'POP' })).toBe('POP')
    expect(targetToType({ kind: 'CLOSURE' })).toBe('CLOSURE')
    expect(targetToType({ kind: 'BUILDING' })).toBe('BUILDING')
  })
})

describe('targetToRef', () => {
  it('builds a POP ref', () => {
    expect(targetToRef({ kind: 'POP', id: 1, label: 'North Exchange' })).toEqual({ popId: 1, name: 'North Exchange' })
  })

  it('builds a CLOSURE ref', () => {
    expect(targetToRef({ kind: 'CLOSURE', id: 2, label: 'JC-01', splitter: '1:8' })).toEqual({ closureId: 2, code: 'JC-01', splitter: '1:8' })
  })

  it('builds a BUILDING ref', () => {
    expect(targetToRef({ kind: 'BUILDING', id: 3, label: 'Tower A' })).toEqual({ buildingId: 3, name: 'Tower A' })
  })
})
