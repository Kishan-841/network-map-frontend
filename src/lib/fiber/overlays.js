/**
 * Pure geometry/identity helpers behind `useFiberOverlays` — how a saved fiber
 * becomes a set of polyline ranges, and how typed points across many fibers
 * collapse into one marker per real-world entity.
 *
 * Nothing here touches `google.*`, so it is unit-testable without the Maps SDK.
 */

const bySequence = (a, b) => a.sequence - b.sequence

/**
 * The polylines to draw for one saved fiber, in draw order.
 *
 * A fiber with segments draws one line per segment (so a cut segment can carry
 * its own red dashed twin) over the point range `[fromPoint … toPoint]`, plus a
 * line for any waypoint run that dangles before the first / after the last
 * typed point — those waypoints belong to no segment but are still part of the
 * drawn path, and dropping them would visibly truncate the route.
 *
 * A fiber with no segments (not yet derived, or a straight A→B line) draws as
 * one polyline over every point.
 *
 * @returns {Array<{ key: string, points: object[], isCut: boolean }>}
 */
export function polylineRanges(fiber) {
  const points = [...(fiber?.points ?? [])].sort(bySequence)
  if (points.length < 2) return []

  const segments = [...(fiber.segments ?? [])].sort(bySequence)
  const whole = [{ key: `${fiber.id}:all`, points, isCut: false }]
  if (segments.length === 0) return whole

  const byId = new Map(points.map((p) => [p.id, p]))
  const ranges = []
  let firstSeq = Infinity
  let lastSeq = -Infinity

  segments.forEach((segment) => {
    const from = byId.get(segment.fromPointId)
    const to = byId.get(segment.toPointId)
    if (!from || !to) return // stale segment: its endpoint was deleted
    const lo = Math.min(from.sequence, to.sequence)
    const hi = Math.max(from.sequence, to.sequence)
    firstSeq = Math.min(firstSeq, lo)
    lastSeq = Math.max(lastSeq, hi)
    const slice = points.filter((p) => p.sequence >= lo && p.sequence <= hi)
    if (slice.length >= 2) {
      ranges.push({ key: `${fiber.id}:seg:${segment.id}`, points: slice, isCut: Boolean(segment.isCut) })
    }
  })

  // Every segment pointed at points that no longer exist — fall back to the
  // whole path rather than drawing nothing.
  if (ranges.length === 0) return whole

  // The dangling waypoint runs. Each includes the typed point it hangs off so
  // the drawn line actually joins the segment beside it.
  const lead = points.filter((p) => p.sequence <= firstSeq)
  if (lead.length >= 2) ranges.unshift({ key: `${fiber.id}:lead`, points: lead, isCut: false })
  const tail = points.filter((p) => p.sequence >= lastSeq)
  if (tail.length >= 2) ranges.push({ key: `${fiber.id}:tail`, points: tail, isCut: false })

  return ranges
}

/**
 * Identity of the real-world thing a point sits on. Two fibers that both start
 * at POP `abc` produce the same key, so they share one marker.
 *
 * Waypoints are pure geometry and have no entity (→ null). A typed point whose
 * entity id is missing falls back to its own id, so it still draws — it just
 * never merges with anything.
 */
const ENTITY_ID = { POP: 'popId', CLOSURE: 'closureId', BUILDING: 'buildingId', SPLITTER: 'splitterId' }

export function entityKey(point) {
  if (point.type === 'WAYPOINT') return null
  const id = point[ENTITY_ID[point.type]]
  return id ? `${point.type}:${id}` : `POINT:${point.id}`
}

/** A closure carrying a splitter draws as a splitter; everything else as its type. */
export function markerKind(point) {
  return point.type === 'CLOSURE' && point.splitter ? 'SPLITTER' : point.type
}

/**
 * A splitter ON the line has a code of its own, so it reads as code and ratio
 * (`S12 · 1:4`, the same line the editor draws); one that only exists as a
 * closure's attachment has nothing but its ratio to show.
 */
export function markerText(kind, point) {
  if (kind !== 'SPLITTER') return point.label ?? ''
  if (point.type !== 'SPLITTER') return point.splitter ?? ''
  const code = point.label ?? ''
  if (!point.splitter) return code
  return code ? `${code} · ${point.splitter}` : point.splitter
}

/**
 * Split every point of every fiber into deduplicated typed entities and plain
 * (never deduplicated) waypoints.
 *
 * @returns {{ entities: Array<{ key, kind, point, fibers }>, waypoints: Array<{ point, fiber }> }}
 */
export function collectMarkers(fibers) {
  const entities = new Map()
  const waypoints = []

  for (const fiber of fibers ?? []) {
    for (const point of fiber.points ?? []) {
      const key = entityKey(point)
      if (!key) {
        waypoints.push({ point, fiber })
        continue
      }
      const existing = entities.get(key)
      if (!existing) {
        entities.set(key, { key, kind: markerKind(point), point, fibers: [fiber] })
        continue
      }
      existing.fibers.push(fiber)
      // The splitter is a property of the closure, not of this fiber's view of
      // it: whichever fiber knows about it upgrades the shared marker.
      if (existing.kind === 'CLOSURE' && point.splitter) {
        existing.kind = 'SPLITTER'
        existing.point = point
      }
    }
  }

  return { entities: [...entities.values()], waypoints }
}
