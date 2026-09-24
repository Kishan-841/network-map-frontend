import { describe, it, expect } from 'vitest'
import { emptyDraft, reduce, deriveSegments, draftErrors, toPayloadPoints, fromApiPoints, isPinned, continuationStart } from '../draft.js'
import { pathMeters } from '../geo.js'

describe('reduce', () => {
  it('add appends points with increasing keys', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 1, longitude: 2 } })
    d = reduce(d, { type: 'add', point: { latitude: 3, longitude: 4 } })
    expect(d.points.map((p) => p.key)).toEqual(['p1', 'p2'])
    expect(d.nextKey).toBe(3)
    expect(d.points[0]).toMatchObject({ type: 'WAYPOINT', latitude: 1, longitude: 2, ref: null })
  })

  it('undo removes the last point', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 1, longitude: 2 } })
    d = reduce(d, { type: 'add', point: { latitude: 3, longitude: 4 } })
    d = reduce(d, { type: 'undo' })
    expect(d.points).toHaveLength(1)
    expect(d.points[0].latitude).toBe(1)
  })

  it('setType to CLOSURE stores a newClosure ref', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 1, longitude: 2 } })
    const key = d.points[0].key
    d = reduce(d, { type: 'setType', key, pointType: 'CLOSURE', ref: { newClosure: { kind: 'INLINE' } } })
    expect(d.points[0]).toMatchObject({ type: 'CLOSURE', ref: { newClosure: { kind: 'INLINE' } } })
  })

  it('move of a pinned point is ignored', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 1, longitude: 2, pointType: 'POP', ref: { popId: 'pop1', name: 'Pop A' } } })
    const key = d.points[0].key
    expect(isPinned(d.points[0])).toBe(true)
    d = reduce(d, { type: 'move', key, latitude: 99, longitude: 99 })
    expect(d.points[0]).toMatchObject({ latitude: 1, longitude: 2 })
  })

  it('move of an unpinned point applies the new coordinates', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 1, longitude: 2 } })
    const key = d.points[0].key
    expect(isPinned(d.points[0])).toBe(false)
    d = reduce(d, { type: 'move', key, latitude: 5, longitude: 6 })
    expect(d.points[0]).toMatchObject({ latitude: 5, longitude: 6 })
  })

  it('move of a BUILDING point is ignored (pinned)', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 1, longitude: 2, pointType: 'BUILDING', ref: { buildingId: 'b1', name: 'Bldg A' } } })
    const key = d.points[0].key
    expect(isPinned(d.points[0])).toBe(true)
    d = reduce(d, { type: 'move', key, latitude: 99, longitude: 99 })
    expect(d.points[0]).toMatchObject({ latitude: 1, longitude: 2 })
  })

  it('move of a saved CLOSURE point is ignored (pinned)', () => {
    let d = emptyDraft()
    d = reduce(d, {
      type: 'add',
      point: { latitude: 1, longitude: 2, pointType: 'CLOSURE', ref: { closureId: 'c1', code: 'JC-0001', splitter: null } },
    })
    const key = d.points[0].key
    expect(isPinned(d.points[0])).toBe(true)
    d = reduce(d, { type: 'move', key, latitude: 99, longitude: 99 })
    expect(d.points[0]).toMatchObject({ latitude: 1, longitude: 2 })
  })

  it('insert adds a point at the given index, shifting later keys but not renaming them', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 1, longitude: 1 } })
    d = reduce(d, { type: 'add', point: { latitude: 2, longitude: 2 } })
    d = reduce(d, { type: 'add', point: { latitude: 3, longitude: 3 } })
    d = reduce(d, { type: 'insert', index: 1, point: { latitude: 1, longitude: 1 } })
    expect(d.points.map((p) => p.key)).toEqual(['p1', 'p4', 'p2', 'p3'])
    expect(d.points[1]).toMatchObject({ key: 'p4', latitude: 1, longitude: 1 })
  })

  it('setType to POP with coordinates moves the vertex and sets the ref', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 0, longitude: 0 } })
    const key = d.points[0].key
    d = reduce(d, { type: 'setType', key, pointType: 'POP', ref: { popId: 'pop1', name: 'Keshav' }, latitude: 18.6, longitude: 73.9 })
    expect(d.points[0]).toMatchObject({ type: 'POP', latitude: 18.6, longitude: 73.9, ref: { popId: 'pop1', name: 'Keshav' } })
  })

  it('setType back to WAYPOINT with no ref clears the ref and keeps coordinates', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 0, longitude: 0 } })
    const key = d.points[0].key
    d = reduce(d, { type: 'setType', key, pointType: 'POP', ref: { popId: 'pop1', name: 'Keshav' }, latitude: 18.6, longitude: 73.9 })
    d = reduce(d, { type: 'setType', key, pointType: 'WAYPOINT' })
    expect(d.points[0]).toMatchObject({ type: 'WAYPOINT', latitude: 18.6, longitude: 73.9, ref: null })
  })

  it('clear resets to an empty draft', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 1, longitude: 2 } })
    d = reduce(d, { type: 'clear' })
    expect(d).toEqual(emptyDraft())
  })

  it('load rebuilds a draft from saved API-shaped points', () => {
    const d = reduce(emptyDraft(), {
      type: 'load',
      points: [
        { latitude: 1, longitude: 2, type: 'POP', ref: { popId: 'pop1', name: 'Pop A' } },
        { latitude: 3, longitude: 4, type: 'WAYPOINT', ref: null },
      ],
    })
    expect(d.points).toHaveLength(2)
    expect(d.points[0]).toMatchObject({ key: 'p1', type: 'POP', ref: { popId: 'pop1', name: 'Pop A' } })
    expect(d.points[1]).toMatchObject({ key: 'p2', type: 'WAYPOINT' })
  })
})

describe('deriveSegments', () => {
  it('returns [] for fewer than two typed points', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 1, longitude: 1, pointType: 'POP', ref: { popId: 'p1', name: 'Pop A' } } })
    d = reduce(d, { type: 'add', point: { latitude: 1.001, longitude: 1 } }) // waypoint only, still one typed point
    expect(deriveSegments(d.points)).toEqual([])
  })

  it('returns [] for an empty draft', () => {
    expect(deriveSegments(emptyDraft().points)).toEqual([])
  })

  it('collapses waypoints between typed points into a single segment', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 0, longitude: 0, pointType: 'POP', ref: { popId: 'p1', name: 'Pop A' } } })
    d = reduce(d, { type: 'add', point: { latitude: 0.001, longitude: 0 } })
    d = reduce(d, { type: 'add', point: { latitude: 0.002, longitude: 0 } })
    d = reduce(d, { type: 'add', point: { latitude: 0.003, longitude: 0, pointType: 'CLOSURE', ref: { closureId: 'c1', code: 'JC-1' } } })
    const segs = deriveSegments(d.points)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ fromIndex: 0, toIndex: 3, fromLabel: 'Pop A', toLabel: 'JC-1' })
    expect(segs[0].mapMeters).toBeGreaterThan(0)
    expect(segs[0].mapMeters).toBe(pathMeters(d.points.slice(segs[0].fromIndex, segs[0].toIndex + 1)))
  })

  it('produces one segment per consecutive pair of typed points', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 0, longitude: 0, pointType: 'POP', ref: { popId: 'p1', name: 'Pop A' } } })
    d = reduce(d, { type: 'add', point: { latitude: 0.001, longitude: 0, pointType: 'CLOSURE', ref: { closureId: 'c1', code: 'JC-1' } } })
    d = reduce(d, { type: 'add', point: { latitude: 0.002, longitude: 0, pointType: 'BUILDING', ref: { buildingId: 'b1', name: 'Bldg A' } } })
    const segs = deriveSegments(d.points)
    expect(segs).toHaveLength(2)
    expect(segs.map((s) => [s.fromIndex, s.toIndex])).toEqual([
      [0, 1],
      [1, 2],
    ])
    expect(segs[1]).toMatchObject({ fromLabel: 'JC-1', toLabel: 'Bldg A' })
  })
})

describe('draftErrors', () => {
  const pop = (lat) => ({ key: 'a', type: 'POP', latitude: lat, longitude: 0, ref: { popId: 'pop1', name: 'Pop A' } })
  const splitterClosure = (lat, closureId = 'c1') => ({
    key: 'b',
    type: 'CLOSURE',
    latitude: lat,
    longitude: 0,
    ref: { closureId, code: 'JC-1', splitter: '1:4', splitterId: 's1' },
  })
  const waypoint = (lat) => ({ key: 'w', type: 'WAYPOINT', latitude: lat, longitude: 0, ref: null })

  it('accepts a splitter closure anywhere on the line', () => {
    expect(draftErrors([pop(0), splitterClosure(1), waypoint(2)])).toEqual([])
    expect(draftErrors([pop(0), waypoint(1), splitterClosure(2)])).toEqual([])
    expect(draftErrors([splitterClosure(0), waypoint(1), pop(2)])).toEqual([])
  })

  it('flags fewer than two points', () => {
    expect(draftErrors([pop(0)])).toContain('Draw at least two points')
  })

  it('returns no errors for a valid two-point draft', () => {
    expect(draftErrors([pop(0), waypoint(1)])).toEqual([])
  })
})

describe('payload <-> API point conversion', () => {
  it('round-trips a saved fiber\'s types and ids through fromApiPoints -> toPayloadPoints', () => {
    const apiPoints = [
      { type: 'POP', latitude: 1, longitude: 2, popId: 'pop1', label: 'Pop A' },
      { type: 'WAYPOINT', latitude: 1.5, longitude: 2.5 },
      {
        type: 'CLOSURE',
        latitude: 2,
        longitude: 3,
        closureId: 'c1',
        label: 'JC-1',
        splitter: '1:4',
        splitterId: 's1',
        splitterRatio: 'R1_4',
        splitterLocation: 'S2',
        splitterFiberType: 'SUB',
      },
      { type: 'BUILDING', latitude: 3, longitude: 4, buildingId: 'b1', label: 'Bldg A' },
    ]
    const draftPoints = fromApiPoints(apiPoints)
    const payload = toPayloadPoints(draftPoints)

    expect(payload).toHaveLength(apiPoints.length)
    expect(payload.map((p) => p.type)).toEqual(['POP', 'WAYPOINT', 'CLOSURE', 'BUILDING'])
    expect(payload.map((p) => [p.latitude, p.longitude])).toEqual(apiPoints.map((p) => [p.latitude, p.longitude]))
    expect(payload[0].popId).toBe('pop1')
    expect(payload[2].closureId).toBe('c1')
    expect(payload[3].buildingId).toBe('b1')
  })

  it("carries the closure's splitter details into the draft ref", () => {
    const [point] = fromApiPoints([
      {
        type: 'CLOSURE',
        latitude: 2,
        longitude: 3,
        closureId: 'c1',
        label: 'JC-1',
        splitter: '1:8',
        splitterId: 's9',
        splitterRatio: 'R1_8',
        splitterLocation: 'S1',
        splitterFiberType: 'MAIN',
      },
    ])
    expect(point.ref).toMatchObject({
      closureId: 'c1',
      code: 'JC-1',
      splitter: '1:8',
      splitterId: 's9',
      splitterRatio: 'R1_8',
      splitterLocation: 'S1',
      splitterFiberType: 'MAIN',
    })
  })

  it('round-trips a SPLITTER point on the line', () => {
    const apiPoints = [
      { type: 'POP', latitude: 1, longitude: 2, popId: 'pop1', label: 'Pop A' },
      {
        type: 'SPLITTER',
        latitude: 1.5,
        longitude: 2.5,
        splitterId: 'sp1',
        label: 'S3',
        splitter: '1:6',
        splitterRatio: 'R1_6',
        splitterLocation: 'S2',
        splitterFiberType: 'SUB',
      },
      { type: 'BUILDING', latitude: 3, longitude: 4, buildingId: 'b1', label: 'Bldg A' },
    ]
    const draftPoints = fromApiPoints(apiPoints)
    expect(draftPoints[1]).toMatchObject({
      type: 'SPLITTER',
      ref: {
        splitterId: 'sp1',
        code: 'S3',
        splitter: '1:6',
        splitterRatio: 'R1_6',
        splitterLocation: 'S2',
        splitterFiberType: 'SUB',
      },
    })
    // A saved splitter is pinned: the splitter owns its position.
    expect(isPinned(draftPoints[1])).toBe(true)

    const payload = toPayloadPoints(draftPoints)
    expect(payload.map((p) => p.type)).toEqual(['POP', 'SPLITTER', 'BUILDING'])
    expect(payload[1].splitterId).toBe('sp1')
    expect(payload[1].newSplitter).toBeUndefined()
  })

  it('emits newSplitter for a splitter that has not been saved yet', () => {
    const point = {
      key: 'p1',
      type: 'SPLITTER',
      latitude: 1,
      longitude: 2,
      ref: { newSplitter: { ratio: 'R1_6', fiberType: 'SUB', location: 'S2' } },
    }
    expect(isPinned(point)).toBe(false)
    const [payload] = toPayloadPoints([point])
    expect(payload).toMatchObject({ type: 'SPLITTER', newSplitter: { ratio: 'R1_6', fiberType: 'SUB', location: 'S2' } })
    expect(payload.splitterId).toBeUndefined()
  })

  it('leaves the splitter fields null on a closure without one', () => {
    const [point] = fromApiPoints([{ type: 'CLOSURE', latitude: 2, longitude: 3, closureId: 'c1', label: 'JC-1' }])
    expect(point.ref).toMatchObject({ splitterId: null, splitterRatio: null, splitterLocation: null, splitterFiberType: null })
  })
})

describe('continuationStart', () => {
  it('returns null when there is no endpoint', () => {
    expect(continuationStart(undefined)).toBeNull()
    expect(continuationStart(null)).toBeNull()
  })

  it('keeps a plain bend as a bare waypoint at the same coordinate', () => {
    expect(continuationStart({ type: 'WAYPOINT', latitude: 1, longitude: 2, ref: null })).toEqual({
      type: 'WAYPOINT',
      latitude: 1,
      longitude: 2,
      ref: null,
    })
  })

  it('connects at a closure endpoint (carries only the closure id + code)', () => {
    const start = continuationStart({
      type: 'CLOSURE',
      latitude: 5,
      longitude: 6,
      ref: { closureId: 'c1', code: 'JC-0007', splitterId: 's1', splitter: '1:4', notes: 'x' },
    })
    expect(start).toEqual({ type: 'CLOSURE', latitude: 5, longitude: 6, ref: { closureId: 'c1', code: 'JC-0007' } })
    // The new fiber references the closure, and nothing else rides along.
    expect(toPayloadPoints([start])[0]).toMatchObject({ closureId: 'c1', splitterId: undefined })
  })

  it('connects at a POP endpoint', () => {
    expect(continuationStart({ type: 'POP', latitude: 7, longitude: 8, ref: { popId: 'p1', name: 'POP A' } })).toEqual({
      type: 'POP',
      latitude: 7,
      longitude: 8,
      ref: { popId: 'p1', name: 'POP A' },
    })
  })

  it('starts a bare waypoint from a splitter endpoint (a splitter is fed, not passed through)', () => {
    const start = continuationStart({ type: 'SPLITTER', latitude: 9, longitude: 10, ref: { splitterId: 's1' } })
    expect(start).toEqual({ type: 'WAYPOINT', latitude: 9, longitude: 10, ref: null })
  })
})
