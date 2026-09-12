import { pathMeters } from './geo.js'

export const emptyDraft = () => ({ points: [], nextKey: 1 })
export const isPinned = (p) => p.type === 'POP' || p.type === 'BUILDING' || (p.type === 'CLOSURE' && Boolean(p.ref?.closureId))
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

const label = (p) => p.ref?.name ?? p.ref?.code ?? (p.ref?.newClosure ? 'New closure' : p.ref?.newPop?.name) ?? p.type

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
export function draftErrors(points, { fromSplitterOutput } = {}) {
  const errors = []
  points.forEach((p, i) => {
    if (p.type !== 'CLOSURE' || !p.ref?.splitter) return
    const ok = i === points.length - 1 || (i === 0 && fromSplitterOutput?.closureId === p.ref.closureId)
    if (!ok) errors.push(`Point ${i + 1} is a splitter closure — a fiber must end there`)
  })
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
    newClosure: p.ref?.newClosure,
    newPop: p.ref?.newPop,
  }))

export const fromApiPoints = (api) =>
  api.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    type: p.type,
    ref:
      p.type === 'POP'
        ? { popId: p.popId, name: p.label }
        : p.type === 'CLOSURE'
          ? { closureId: p.closureId, code: p.label, splitter: p.splitter }
          : p.type === 'BUILDING'
            ? { buildingId: p.buildingId, name: p.label }
            : null,
  }))
