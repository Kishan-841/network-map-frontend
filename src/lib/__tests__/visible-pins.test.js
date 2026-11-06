import { describe, it, expect } from 'vitest'
import {
  CLUSTER_OPTIONS,
  buildIndex,
  clusterBounds,
  padBounds,
  reconcile,
  visibleItems,
} from '../visible-pins'

// Ten buildings ~10 m apart near 18.5, 73.8, plus one far away (Mumbai-ish).
const near = Array.from({ length: 10 }, (_, i) => ({
  id: `n${i}`,
  latitude: 18.5 + i * 0.0001,
  longitude: 73.8 + i * 0.0001,
}))
const far = { id: 'far', latitude: 19.07, longitude: 72.87 }
const twinA = { id: 'twinA', latitude: 18.51, longitude: 73.81 }
const twinB = { id: 'twinB', latitude: 18.51, longitude: 73.81 }
const buildings = [...near, far, twinA, twinB]
const around = { west: 73.79, south: 18.49, east: 73.82, north: 18.52 } // near + twins, not far

describe('CLUSTER_OPTIONS', () => {
  it('matches today’s clusterer exactly', () => {
    expect(CLUSTER_OPTIONS).toEqual({ radius: 60, maxZoom: 16, minPoints: 2 })
  })
})

describe('visibleItems', () => {
  it('at zoom 17 every building in view is its own pin, even two at the same spot', () => {
    const items = visibleItems(buildIndex(buildings), around, 17)
    expect(items.every((i) => i.kind === 'pin')).toBe(true)
    expect(items.map((i) => i.building.id).sort()).toEqual([...near.map((b) => b.id), 'twinA', 'twinB'].sort())
    expect(items.find((i) => i.building.id === 'n0').key).toBe('b:n0')
  })

  it('zoomed out, close buildings become one bubble with their count', () => {
    const items = visibleItems(buildIndex(buildings), around, 10)
    const clusters = items.filter((i) => i.kind === 'cluster')
    expect(clusters).toHaveLength(1)
    expect(clusters[0].count).toBe(12) // the ten + the two twins, all within 60 px at zoom 10
    expect(clusters[0].key).toMatch(/^c:10:-?\d+\.\d{6},-?\d+\.\d{6}:12$/)
  })

  it('counts of bubbles + pins equal the buildings inside the area', () => {
    const items = visibleItems(buildIndex(buildings), around, 14)
    const total = items.reduce((n, i) => n + (i.kind === 'cluster' ? i.count : 1), 0)
    expect(total).toBe(12)
  })

  it('leaves out buildings outside the area', () => {
    const items = visibleItems(buildIndex(buildings), around, 17)
    expect(items.some((i) => i.kind === 'pin' && i.building.id === 'far')).toBe(false)
  })

  it('rounds a fractional zoom', () => {
    const items = visibleItems(buildIndex(buildings), around, 16.6)
    expect(items.every((i) => i.kind === 'pin')).toBe(true)
  })

  it('gives the same keys when the same buildings arrive as a new array (quiet refresh)', () => {
    const keys = (list) => visibleItems(buildIndex(list), around, 10).map((i) => i.key).sort()
    expect(keys(buildings.map((b) => ({ ...b })))).toEqual(keys(buildings))
  })

  it('returns nothing for an empty list', () => {
    expect(visibleItems(buildIndex([]), around, 12)).toEqual([])
  })
})

describe('padBounds', () => {
  it('grows each side by a quarter of the span', () => {
    expect(padBounds({ west: 0, south: 0, east: 4, north: 2 })).toEqual({ west: -1, south: -0.5, east: 5, north: 2.5 })
  })
})

describe('clusterBounds', () => {
  it('covers every building in the bubble', () => {
    const index = buildIndex(buildings)
    const cluster = visibleItems(index, around, 10).find((i) => i.kind === 'cluster')
    const b = clusterBounds(index, cluster.clusterId)
    for (const x of [...near, twinA]) {
      expect(x.longitude).toBeGreaterThanOrEqual(b.west)
      expect(x.longitude).toBeLessThanOrEqual(b.east)
      expect(x.latitude).toBeGreaterThanOrEqual(b.south)
      expect(x.latitude).toBeLessThanOrEqual(b.north)
    }
  })
})

describe('reconcile', () => {
  it('adds new keys, keeps drawn ones, removes gone ones', () => {
    const b2 = { key: 'b:2' }
    expect(reconcile(['b:1', 'c:x'], [{ key: 'b:1' }, b2])).toEqual({ add: [b2], keep: ['b:1'], remove: ['c:x'] })
  })

  it('removes everything when nothing is in view (a filter emptied the map)', () => {
    expect(reconcile(new Set(['b:1', 'c:y']), [])).toEqual({ add: [], keep: [], remove: ['b:1', 'c:y'] })
  })
})
