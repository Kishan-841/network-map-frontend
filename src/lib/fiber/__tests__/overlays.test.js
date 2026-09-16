import { describe, it, expect } from 'vitest'
import { polylineRanges, entityKey, markerKind, markerText, collectMarkers } from '../overlays.js'

const point = (id, sequence, extra = {}) => ({ id, sequence, latitude: 18.5 + sequence / 1000, longitude: 73.8, type: 'WAYPOINT', label: null, splitter: null, ...extra })

describe('polylineRanges', () => {
  it('splits two segments and a trailing waypoint run into three ranges', () => {
    const fiber = {
      id: 'f1',
      points: [
        point('p0', 0, { type: 'POP', popId: 'pop1' }),
        point('p1', 1),
        point('p2', 2, { type: 'CLOSURE', closureId: 'c1' }),
        point('p3', 3, { type: 'BUILDING', buildingId: 'b1' }),
        point('p4', 4), // trailing waypoints hang off the last typed point
        point('p5', 5),
      ],
      segments: [
        { id: 's1', sequence: 0, fromPointId: 'p0', toPointId: 'p2', isCut: false },
        { id: 's2', sequence: 1, fromPointId: 'p2', toPointId: 'p3', isCut: true },
      ],
    }
    const ranges = polylineRanges(fiber)
    expect(ranges.map((r) => r.points.map((p) => p.id))).toEqual([
      ['p0', 'p1', 'p2'],
      ['p2', 'p3'],
      ['p3', 'p4', 'p5'],
    ])
    expect(ranges.map((r) => r.isCut)).toEqual([false, true, false])
    expect(new Set(ranges.map((r) => r.key)).size).toBe(3)
  })

  it('adds a leading run when waypoints precede the first typed point', () => {
    const fiber = {
      id: 'f2',
      points: [point('a', 0), point('b', 1), point('c', 2, { type: 'POP', popId: 'pop1' }), point('d', 3, { type: 'CLOSURE', closureId: 'c1' })],
      segments: [{ id: 's1', sequence: 0, fromPointId: 'c', toPointId: 'd', isCut: false }],
    }
    expect(polylineRanges(fiber).map((r) => r.points.map((p) => p.id))).toEqual([['a', 'b', 'c'], ['c', 'd']])
  })

  it('draws one range over the whole path when there are no segments', () => {
    const fiber = { id: 'f3', points: [point('a', 0), point('b', 1), point('c', 2)], segments: [] }
    const ranges = polylineRanges(fiber)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].points.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(ranges[0].isCut).toBe(false)
  })

  it('falls back to the whole path when every segment references a deleted point', () => {
    const fiber = { id: 'f4', points: [point('a', 0), point('b', 1)], segments: [{ id: 's1', sequence: 0, fromPointId: 'gone', toPointId: 'b' }] }
    expect(polylineRanges(fiber)).toHaveLength(1)
  })

  it('draws nothing for a fiber with fewer than two points', () => {
    expect(polylineRanges({ id: 'f5', points: [point('a', 0)], segments: [] })).toEqual([])
    expect(polylineRanges({ id: 'f6', points: [], segments: [] })).toEqual([])
  })
})

describe('entityKey / markerKind / markerText', () => {
  it('keys typed points by their entity and waypoints not at all', () => {
    expect(entityKey(point('p', 0, { type: 'POP', popId: 'pop1' }))).toBe('POP:pop1')
    expect(entityKey(point('p', 0, { type: 'CLOSURE', closureId: 'c1' }))).toBe('CLOSURE:c1')
    expect(entityKey(point('p', 0, { type: 'BUILDING', buildingId: 'b1' }))).toBe('BUILDING:b1')
    expect(entityKey(point('p', 0, { type: 'SPLITTER', splitterId: 'sp1' }))).toBe('SPLITTER:sp1')
    expect(entityKey(point('p', 0))).toBeNull()
    // A typed point missing its entity id still draws, but never merges.
    expect(entityKey(point('p9', 0, { type: 'POP' }))).toBe('POINT:p9')
  })

  it('draws a closure with a splitter as a splitter, labelled with its ratio', () => {
    const plain = point('p', 0, { type: 'CLOSURE', closureId: 'c1', label: 'CL-01' })
    const split = point('p', 0, { type: 'CLOSURE', closureId: 'c1', label: 'CL-02', splitter: '1:8' })
    expect(markerKind(plain)).toBe('CLOSURE')
    expect(markerKind(split)).toBe('SPLITTER')
    expect(markerText('CLOSURE', plain)).toBe('CL-01')
    expect(markerText('SPLITTER', split)).toBe('1:8')
    expect(markerText('CLOSURE', point('p', 0, { type: 'CLOSURE' }))).toBe('')
  })

  it('labels a splitter ON the line with its own code', () => {
    const online = point('p', 0, { type: 'SPLITTER', splitterId: 'sp1', label: 'S3', splitter: '1:6' })
    expect(markerKind(online)).toBe('SPLITTER')
    expect(markerText('SPLITTER', online)).toBe('S3')
  })
})

describe('collectMarkers', () => {
  it('gives two fibers sharing a POP one entity that remembers both', () => {
    const pop = { type: 'POP', popId: 'pop1', label: 'Main POP' }
    const fiberA = { id: 'fa', points: [point('a0', 0, pop), point('a1', 1), point('a2', 2, { type: 'CLOSURE', closureId: 'c1' })] }
    const fiberB = { id: 'fb', points: [point('b0', 0, pop), point('b1', 1, { type: 'BUILDING', buildingId: 'b1' })] }

    const { entities, waypoints } = collectMarkers([fiberA, fiberB])
    expect(entities.map((e) => e.key)).toEqual(['POP:pop1', 'CLOSURE:c1', 'BUILDING:b1'])
    const shared = entities.find((e) => e.key === 'POP:pop1')
    expect(shared.fibers.map((f) => f.id)).toEqual(['fa', 'fb'])
    // Waypoints are pure geometry: never deduplicated, one marker each.
    expect(waypoints.map((w) => w.point.id)).toEqual(['a1'])
  })

  it('upgrades a shared closure to a splitter when any fiber knows about it', () => {
    const fiberA = { id: 'fa', points: [point('a0', 0, { type: 'CLOSURE', closureId: 'c1', label: 'CL-01' })] }
    const fiberB = { id: 'fb', points: [point('b0', 0, { type: 'CLOSURE', closureId: 'c1', label: 'CL-01', splitter: '1:4' })] }
    const { entities } = collectMarkers([fiberA, fiberB])
    expect(entities).toHaveLength(1)
    expect(entities[0].kind).toBe('SPLITTER')
    expect(markerText(entities[0].kind, entities[0].point)).toBe('1:4')
  })

  it('handles an empty list and fibers with no points', () => {
    expect(collectMarkers([])).toEqual({ entities: [], waypoints: [] })
    expect(collectMarkers([{ id: 'f', points: undefined }])).toEqual({ entities: [], waypoints: [] })
  })
})
