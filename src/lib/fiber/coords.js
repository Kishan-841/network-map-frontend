/**
 * Pune, Maharashtra — where the network is. A blank form opens here rather
 * than at a country-wide view nobody can place a pin on.
 */
export const DEFAULT_CENTRE = { latitude: 18.5204, longitude: 73.8567 }

/**
 * A typed coordinate, or null when the box holds nothing usable.
 *
 * The `null` matters more than the number: `Number('')` is 0, so an empty
 * field used to read as a perfectly valid coordinate, the map opened at 0,0
 * in the Gulf of Guinea, and a form could be saved with a site pinned there.
 */
const parseCoord = (value, limit) => {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

export const parseLatitude = (value) => parseCoord(value, 90)
export const parseLongitude = (value) => parseCoord(value, 180)
