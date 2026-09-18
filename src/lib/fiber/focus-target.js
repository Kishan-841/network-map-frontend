/**
 * What the map should frame when something is clicked: one point for a POP,
 * a building or a closure; the whole run of points for a fiber, so the cable
 * is framed rather than centred on wherever the tap landed.
 *
 * Accepts both spellings — our rows carry `latitude`/`longitude`, the Maps API
 * hands back `lat`/`lng` — and drops anything that is not a real coordinate,
 * because one bad point drags the view out to sea.
 */
const toLatLng = (p) => {
  const lat = p?.latitude ?? p?.lat
  const lng = p?.longitude ?? p?.lng
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

export function focusPoints(target) {
  const list = Array.isArray(target) ? target : [target]
  return list.map(toLatLng).filter(Boolean)
}
