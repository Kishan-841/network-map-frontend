const R = 6371008.8 // mean Earth radius, metres
const rad = (deg) => (deg * Math.PI) / 180

/** Great-circle distance between two { latitude, longitude } points, in metres. */
export function haversineMeters(a, b) {
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Length of an ordered path, in metres. */
export function pathMeters(points) {
  let total = 0
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i])
  return total
}
