import { describe, it, expect } from 'vitest'
import { emptyDraft, reduce, deriveSegments, draftErrors, toPayloadPoints, fromApiPoints, isPinned } from '../draft.js'

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
    d = reduce(d, { type: 'add', point: { latitude: 0.003, longitude: 0, pointType: 'CLOSURE', ref: { closureId: 'c1', code: 'CL-1' } } })
    const segs = deriveSegments(d.points)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ fromIndex: 0, toIndex: 3, fromLabel: 'Pop A', toLabel: 'CL-1' })
    expect(segs[0].mapMeters).toBeGreaterThan(0)
  })

  it('produces one segment per consecutive pair of typed points', () => {
    let d = emptyDraft()
    d = reduce(d, { type: 'add', point: { latitude: 0, longitude: 0, pointType: 'POP', ref: { popId: 'p1', name: 'Pop A' } } })
    d = reduce(d, { type: 'add', point: { latitude: 0.001, longitude: 0, pointType: 'CLOSURE', ref: { closureId: 'c1', code: 'CL-1' } } })
    d = reduce(d, { type: 'add', point: { latitude: 0.002, longitude: 0, pointType: 'BUILDING', ref: { buildingId: 'b1', name: 'Bldg A' } } })
    const segs = deriveSegments(d.points)
    expect(segs).toHaveLength(2)
    expect(segs.map((s) => [s.fromIndex, s.toIndex])).toEqual([
      [0, 1],
      [1, 2],
    ])
    expect(segs[1]).toMatchObject({ fromLabel: 'CL-1', toLabel: 'Bldg A' })
  })
})

describe('draftErrors', () => {
  const pop = (lat) => ({ key: 'a', type: 'POP', latitude: lat, longitude: 0, ref: { popId: 'pop1', name: 'Pop A' } })
  const splitterClosure = (lat, closureId = 'c1') => ({
    key: 'b',
    type: 'CLOSURE',
    latitude: lat,
    longitude: 0,
    ref: { closureId, code: 'CL-1', splitter: true },
  })
  const waypoint = (lat) => ({ key: 'w', type: 'WAYPOINT', latitude: lat, longitude: 0, ref: null })

  it('flags a splitter closure that is not the last point', () => {
    const points = [pop(0), splitterClosure(1), waypoint(2)]
    const errors = draftErrors(points, {})
    expect(errors).toContain('Point 2 is a splitter closure — a fiber must end there')
  })

  it('accepts a splitter closure as the last point', () => {
    const points = [pop(0), waypoint(1), splitterClosure(2)]
    const errors = draftErrors(points, {})
    expect(errors.some((e) => e.includes('splitter closure'))).toBe(false)
  })

  it('accepts a splitter closure as the first point when it matches fromSplitterOutput.closureId', () => {
    const points = [splitterClosure(0, 'c1'), waypoint(1), pop(2)]
    const errors = draftErrors(points, { fromSplitterOutput: { closureId: 'c1' } })
    expect(errors.some((e) => e.includes('splitter closure'))).toBe(false)
  })

  it('flags a splitter closure as the first point when fromSplitterOutput.closureId does not match', () => {
    const points = [splitterClosure(0, 'c1'), waypoint(1), pop(2)]
    const errors = draftErrors(points, { fromSplitterOutput: { closureId: 'other' } })
    expect(errors.some((e) => e.includes('splitter closure'))).toBe(true)
  })

  it('flags fewer than two points', () => {
    expect(draftErrors([pop(0)], {})).toContain('Draw at least two points')
  })

  it('returns no errors for a valid two-point draft', () => {
    expect(draftErrors([pop(0), waypoint(1)], {})).toEqual([])
  })
})

describe('payload <-> API point conversion', () => {
  it('round-trips a saved fiber\'s types and ids through fromApiPoints -> toPayloadPoints', () => {
    const apiPoints = [
      { type: 'POP', latitude: 1, longitude: 2, popId: 'pop1', label: 'Pop A' },
      { type: 'WAYPOINT', latitude: 1.5, longitude: 2.5 },
      { type: 'CLOSURE', latitude: 2, longitude: 3, closureId: 'c1', label: 'CL-1', splitter: true },
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
})
