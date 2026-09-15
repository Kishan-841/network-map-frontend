/**
 * Point-to-line-segment maths for "click on the line" gestures. Pure screen
 * pixels — the caller projects the draft's LatLngs first — so this is the
 * segment counterpart of snap.js's point-to-point `findSnap`, and testable
 * without a map.
 */

/** Projection of `pixel` onto the segment a→b, clamped to the segment. */
function projectOnSegment(a, b, pixel) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  // A zero-length segment (two vertices on the same pixel) projects onto `a`.
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((pixel.x - a.x) * dx + (pixel.y - a.y) * dy) / lengthSq))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

/**
 * Nearest point on a polyline to `pixel`, or null when nothing is within
 * `maxPx`. `index` is the vertex the projected point sits AFTER — insert the
 * new point at `index + 1` to land it between the two vertices it was drawn
 * between.
 *
 * @param {{x:number,y:number}[]} pathPixels vertices in container pixels
 * @param {{x:number,y:number}} pixel the click, in the same coordinates
 * @returns {{ index:number, x:number, y:number, distance:number } | null}
 */
export function nearestPointOnPath(pathPixels, pixel, maxPx = 12) {
  if (!Array.isArray(pathPixels) || pathPixels.length < 2) return null
  let best = null
  for (let i = 0; i < pathPixels.length - 1; i++) {
    const a = pathPixels[i]
    const b = pathPixels[i + 1]
    if (!a || !b) continue
    const hit = projectOnSegment(a, b, pixel)
    const distance = Math.hypot(hit.x - pixel.x, hit.y - pixel.y)
    // Strictly nearer: a click on a shared vertex belongs to the earlier
    // segment, so the new point never jumps past the vertex it was aimed at.
    if (distance < (best?.distance ?? Infinity)) best = { index: i, x: hit.x, y: hit.y, distance }
  }
  return best && best.distance <= maxPx ? best : null
}
