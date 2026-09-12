import { haversineMeters } from './geo.js'

export const SNAP_PX = 14
export const SNAP_METERS = 25

/**
 * Nearest target passing BOTH the screen-pixel test and the ground-metre
 * test, else null. `projectPixel(target)` converts a target to a
 * `{ x, y }` screen pixel — the caller wraps `google.maps` projection so
 * this module stays free of `google.*` and is testable without a map.
 */
export function findSnap(targets, { pixel, latLng, pxRadius = SNAP_PX, meterRadius = SNAP_METERS, projectPixel }) {
  let best = null
  let bestPxDist = Infinity
  for (const target of targets) {
    const targetPixel = projectPixel(target)
    const pxDist = Math.hypot(targetPixel.x - pixel.x, targetPixel.y - pixel.y)
    if (pxDist > pxRadius) continue
    const meterDist = haversineMeters(latLng, target)
    if (meterDist > meterRadius) continue
    if (pxDist < bestPxDist) {
      best = target
      bestPxDist = pxDist
    }
  }
  return best
}

export const targetToType = (t) => t.kind // 'POP' | 'CLOSURE' | 'BUILDING'

export const targetToRef = (t) =>
  t.kind === 'POP'
    ? { popId: t.id, name: t.label }
    : t.kind === 'CLOSURE'
      ? { closureId: t.id, code: t.label, splitter: t.splitter }
      : { buildingId: t.id, name: t.label }
