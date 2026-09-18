/**
 * Which zone a drawn fiber starts in.
 *
 * The Save step pre-selects this so a surveyor in the field does not hunt for
 * the zone they are standing in — it stays a suggestion, and the picker is
 * right there to correct it. The API re-checks whatever is sent, so a wrong
 * guess can never widen what a surveyor may do.
 *
 * Zone boundaries are stored as `[{ latitude, longitude }, …]`, but older rows
 * and the Maps API use `{ lat, lng }`, so both are read.
 */
const vertex = (p) => ({
  lat: p?.latitude ?? p?.lat,
  lng: p?.longitude ?? p?.lng,
})

const EDGE_TOLERANCE = 1e-9

/**
 * Ray casting, with the edge counted as inside: a cable drawn along a zone
 * border should still guess that zone rather than nothing.
 */
function contains(boundary, point) {
  const ring = (boundary ?? []).map(vertex).filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng))
  if (ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    // On this edge (within a rounding hair) → treat as inside.
    const cross = (b.lat - a.lat) * (point.lng - a.lng) - (b.lng - a.lng) * (point.lat - a.lat)
    const withinLat = point.lat >= Math.min(a.lat, b.lat) - EDGE_TOLERANCE && point.lat <= Math.max(a.lat, b.lat) + EDGE_TOLERANCE
    const withinLng = point.lng >= Math.min(a.lng, b.lng) - EDGE_TOLERANCE && point.lng <= Math.max(a.lng, b.lng) + EDGE_TOLERANCE
    if (Math.abs(cross) <= EDGE_TOLERANCE && withinLat && withinLng) return true
    const straddles = a.lat > point.lat !== b.lat > point.lat
    if (straddles) {
      const x = ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng
      if (point.lng < x) inside = !inside
    }
  }
  return inside
}

export function guessZoneId(zones, points) {
  const first = (points ?? [])[0]
  const at = first && vertex(first)
  if (!at || !Number.isFinite(at.lat) || !Number.isFinite(at.lng)) return null
  return (zones ?? []).find((zone) => contains(zone.boundary, at))?.id ?? null
}
