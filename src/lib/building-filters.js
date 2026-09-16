/**
 * In-browser mirror of the API's building filters.
 *
 * The map loads every marker once (`useBuildingMarkers`) and narrows the set
 * here, so changing a filter is instant and costs no request. These
 * predicates must match `buildListWhere` in the backend's building.service —
 * if they drift, the map shows a different answer than the Buildings list for
 * the same filter, which is exactly the confusion the markers endpoint was
 * added to end.
 *
 * Role scoping is NOT mirrored: the API has already dropped every row the
 * actor may not see before these markers reach the browser.
 */

const matchesText = (value, needle) =>
  typeof value === 'string' && value.toLowerCase().includes(needle)

/** The day part of an ISO timestamp, compared as a string ('2026-07-22'). */
const isoDay = (value) => (typeof value === 'string' ? value.slice(0, 10) : '')

/**
 * @param {Array} markers rows from `/buildings/markers`
 * @param {object} filters `{ search, operatorId, zoneId, createdById, cityId, dateFrom, dateTo }`
 *   — blank/undefined values are ignored, so an untouched filter sheet is a
 *   no-op rather than a filter that matches nothing.
 */
export function filterMarkers(markers = [], filters = {}) {
  const { search, operatorId, zoneId, createdById, cityId, dateFrom, dateTo } = filters
  // Case-insensitive substring, matched the way the API's OR does it.
  const needle = search?.trim().toLowerCase()

  return markers.filter((marker) => {
    if (
      needle &&
      !matchesText(marker.buildingName, needle) &&
      !matchesText(marker.formattedAddress, needle) &&
      !matchesText(marker.zone?.name, needle)
    ) {
      return false
    }
    // A building has no operator of its own — it reaches one through its zone,
    // the same join the API filters on (`where.zone = { operatorId }`).
    if (operatorId && marker.zone?.operatorId !== operatorId) return false
    if (zoneId && marker.zoneId !== zoneId && marker.zone?.id !== zoneId) return false
    if (createdById && marker.createdById !== createdById) return false
    // Acquisition rows carry cityId directly; this is the acquisition map's
    // city filter, which is the only place a marker's own cityId is set.
    if (cityId && marker.cityId !== cityId) return false
    // Both bounds are inclusive of the whole day, matching the API's
    // `gte dateFrom` / `lte dateTo 23:59:59.999`.
    if (dateFrom || dateTo) {
      const day = isoDay(marker.createdAt)
      if (!day) return false
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
    }
    return true
  })
}
