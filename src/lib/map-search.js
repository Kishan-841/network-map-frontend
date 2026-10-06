import { filterRows } from './client-table'

/**
 * The map's one search box: Google places AND our own buildings. Pure, so
 * vitest can load it without the map or the Places SDK.
 */

/** Below this, neither list is searched — Places bills per request. */
export const MIN_SEARCH_CHARS = 3
export const MAX_BUILDING_RESULTS = 5

/**
 * Our buildings matching what was typed: name, address or zone, every word in
 * any order (the same fields the old filter box searched).
 */
export function matchBuildings(buildings, query, limit = MAX_BUILDING_RESULTS) {
  const text = String(query ?? '').trim()
  if (text.length < MIN_SEARCH_CHARS || !Array.isArray(buildings)) return []
  return filterRows(buildings, text, (b) => [b.buildingName, b.formattedAddress, b.zone?.name]).slice(0, limit)
}

/**
 * The red pin for a picked place, or null when the place has no usable
 * coordinates (a pin at 0,0 or NaN would be worse than no pin).
 */
export function searchPinFrom(prediction, coords) {
  const latitude = Number(coords?.latitude)
  const longitude = Number(coords?.longitude)
  if (coords?.latitude == null || coords?.longitude == null) return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const label = [prediction?.primaryText, prediction?.secondaryText].filter(Boolean).join(', ')
  return { latitude, longitude, label }
}
