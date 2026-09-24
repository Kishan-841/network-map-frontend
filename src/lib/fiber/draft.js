import { pathMeters } from './geo.js'

export const emptyDraft = () => ({ points: [], nextKey: 1 })
// A point pinned to a real entity cannot be dragged: the entity owns the
// position. An unsaved closure/splitter is still just a spot on the line.
export const isPinned = (p) =>
  p.type === 'POP' ||
  p.type === 'BUILDING' ||
  (p.type === 'CLOSURE' && Boolean(p.ref?.closureId)) ||
  (p.type === 'SPLITTER' && Boolean(p.ref?.splitterId))
const mk = (d, point) => ({ key: `p${d.nextKey}`, type: point.pointType ?? 'WAYPOINT', latitude: point.latitude, longitude: point.longitude, ref: point.ref ?? null })

export function reduce(d, a) {
  switch (a.type) {
    case 'add':
      return { points: [...d.points, mk(d, a.point)], nextKey: d.nextKey + 1 }
    case 'insert':
      return { points: [...d.points.slice(0, a.index), mk(d, a.point), ...d.points.slice(a.index)], nextKey: d.nextKey + 1 }
    case 'move':
      return { ...d, points: d.points.map((p) => (p.key === a.key && !isPinned(p) ? { ...p, latitude: a.latitude, longitude: a.longitude } : p)) }
    case 'setType':
      return {
        ...d,
        points: d.points.map((p) =>
          p.key === a.key ? { ...p, type: a.pointType, ref: a.ref ?? null, ...(a.latitude != null ? { latitude: a.latitude, longitude: a.longitude } : {}) } : p
        ),
      }
    case 'remove':
      return { ...d, points: d.points.filter((p) => p.key !== a.key) }
    case 'undo':
      return { ...d, points: d.points.slice(0, -1) }
    case 'clear':
      return emptyDraft()
    case 'load':
      return a.points.reduce((s, p) => reduce(s, { type: 'add', point: { latitude: p.latitude, longitude: p.longitude, pointType: p.type, ref: p.ref } }), emptyDraft())
    default:
      return d
  }
}

const label = (p) =>
  p.ref?.name ??
  p.ref?.code ??
  (p.ref?.newClosure ? 'New closure' : p.ref?.newSplitter ? 'New splitter' : p.ref?.newPop?.name) ??
  p.type

export function deriveSegments(points) {
  const typed = points.map((p, index) => ({ p, index })).filter(({ p }) => p.type !== 'WAYPOINT')
  return typed.slice(1).map(({ p, index }, k) => ({
    fromIndex: typed[k].index,
    toIndex: index,
    mapMeters: pathMeters(points.slice(typed[k].index, index + 1)),
    fromLabel: label(typed[k].p),
    toLabel: label(p),
  }))
}

// YOUR TURN (optional): client-side drawing rules live here — e.g. reject two identical consecutive typed points.
// A splitter may sit on any closure of a line, so where one sits is not a
// drawing rule any more — length is the only one left.
export function draftErrors(points) {
  const errors = []
  if (points.length < 2) errors.push('Draw at least two points')
  return errors
}

export const toPayloadPoints = (points) =>
  points.map((p) => ({
    type: p.type,
    latitude: p.latitude,
    longitude: p.longitude,
    popId: p.ref?.popId,
    closureId: p.ref?.closureId,
    buildingId: p.ref?.buildingId,
    splitterId: p.ref?.splitterId,
    newClosure: p.ref?.newClosure,
    newPop: p.ref?.newPop,
    newSplitter: p.ref?.newSplitter,
  }))

/**
 * The first point of a fiber that continues from where another one ended.
 * Keeps the endpoint's coordinate so the new line starts exactly there, and
 * carries the endpoint's entity reference when it is a closure, POP or
 * building — so the two fibers connect at that junction. A plain bend, or a
 * splitter (which is fed, not passed through), starts a bare WAYPOINT instead.
 * Returns null when there is no point to continue from.
 */
export const continuationStart = (point) => {
  if (!point) return null
  const at = { latitude: point.latitude, longitude: point.longitude }
  const ref = point.ref
  if (point.type === 'CLOSURE' && ref?.closureId)
    return { ...at, type: 'CLOSURE', ref: { closureId: ref.closureId, code: ref.code ?? null } }
  if (point.type === 'POP' && ref?.popId)
    return { ...at, type: 'POP', ref: { popId: ref.popId, name: ref.name ?? null } }
  if (point.type === 'BUILDING' && ref?.buildingId)
    return { ...at, type: 'BUILDING', ref: { buildingId: ref.buildingId, name: ref.name ?? null } }
  return { ...at, type: 'WAYPOINT', ref: null }
}

export const fromApiPoints = (api) =>
  api.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    type: p.type,
    ref:
      p.type === 'POP'
        ? { popId: p.popId, name: p.label }
        : p.type === 'CLOSURE'
          ? {
              closureId: p.closureId,
              code: p.label,
              // `splitter` stays the marker's ratio LABEL ('1:4'); the rest is
              // what the splitter modal edits.
              splitter: p.splitter,
              splitterId: p.splitterId ?? null,
              splitterRatio: p.splitterRatio ?? null,
              splitterLocation: p.splitterLocation ?? null,
              splitterFiberType: p.splitterFiberType ?? null,
              kind: p.kind ?? null,
              notes: p.closure?.notes ?? null,
            }
          : p.type === 'BUILDING'
            ? { buildingId: p.buildingId, name: p.label }
            : p.type === 'SPLITTER'
              ? {
                  splitterId: p.splitterId ?? null,
                  code: p.label,
                  // Same four fields as a closure-attached splitter, so one card
                  // and one modal read both. `splitter` is the ratio LABEL.
                  splitter: p.splitter,
                  splitterRatio: p.splitterRatio ?? null,
                  splitterLocation: p.splitterLocation ?? null,
                  splitterFiberType: p.splitterFiberType ?? null,
                }
              : null,
  }))
