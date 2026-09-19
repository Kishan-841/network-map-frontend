/**
 * Small formatters for the detail drawer. The drawer shows every field of a
 * record, filled or not, so a blank answer on the survey sheet is visible as
 * "Not recorded" rather than silently missing.
 */
export const NOT_RECORDED = 'Not recorded'

export function shown(value) {
  if (value === null || value === undefined) return NOT_RECORDED
  if (typeof value === 'string' && value.trim() === '') return NOT_RECORDED
  return value
}

/** "19 Sep 2026, 5:32 pm" in India time — the field works in IST. */
export function formatWhen(value) {
  if (!value) return NOT_RECORDED
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return NOT_RECORDED
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

const isCoord = (n) => typeof n === 'number' && Number.isFinite(n)

export function coordText(latitude, longitude) {
  if (!isCoord(latitude) || !isCoord(longitude)) return NOT_RECORDED
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

/** A Google Maps link a phone opens in the Maps app — for walking to the site. */
export function mapsUrl(latitude, longitude) {
  if (!isCoord(latitude) || !isCoord(longitude)) return null
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

/** An ADMIN reading a row nobody could be traced to sees why it has no name. */
export const addedBy = (record) => record?.createdBy?.name ?? 'Unknown (recorded before owners were kept)'
