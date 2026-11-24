/**
 * Where a splitter sits inside a building (spec 2026-11-24-splitter-in-building):
 * Terrace / Floor n / Ground / Basement, plus the form ↔ API shapes.
 * Mirrors backend SPLITTER_PLACEMENTS and MAX_FLOOR (src/lib/fiber-constants.js).
 */
export const PLACEMENTS = [
  { value: 'TERRACE', label: 'Terrace' },
  { value: 'FLOOR', label: 'Floor' },
  { value: 'GROUND', label: 'Ground' },
  { value: 'BASEMENT', label: 'Basement' },
]
export const MAX_FLOOR = 200
const LABEL = Object.fromEntries(PLACEMENTS.map((p) => [p.value, p.label]))

export function placementLabel({ placement, floorNumber } = {}) {
  if (!placement) return null
  return placement === 'FLOOR' && floorNumber != null ? `Floor ${floorNumber}` : (LABEL[placement] ?? placement)
}

/** The form's problem with the floor, or null. `floorNumber` is the input's string. */
export function splitterPlaceError({ placement, floorNumber }) {
  if (placement !== 'FLOOR') return null
  const text = String(floorNumber ?? '').trim()
  if (!text) return 'Which floor?'
  const n = Number(text)
  return Number.isInteger(n) && n >= 1 && n <= MAX_FLOOR ? null : `Floor must be from 1 to ${MAX_FLOOR}`
}

/** The building fields of a splitter body: blanks as null, the floor only with Floor. */
export function splitterPlaceBody({ wingId, placement, floorNumber, note }) {
  return {
    wingId: wingId || null,
    placement: placement || null,
    floorNumber: placement === 'FLOOR' ? Number(floorNumber) : null,
    note: (note ?? '').trim() || null,
  }
}

/** Where a splitter is, in one line: its building (wing, place), its closure, or the line it sits on. */
export function splitterWhere(s) {
  if (s.building) {
    // A closure splitter given a building later keeps its closure first.
    return [s.closure ? `Closure ${s.closure.code}` : null, s.building.buildingName, s.wing ? `Wing ${s.wing.name}` : null, placementLabel(s)]
      .filter(Boolean)
      .join(' · ')
  }
  if (s.closure) return `Closure ${s.closure.code}`
  if (s.onFiber) return `On ${s.onFiber.name}`
  return '—'
}

export const distanceLabel = (m) => (m == null ? null : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

/**
 * The input-fibre part of a splitter body. Adding: always. Editing: only when the user changed it —
 * the form starts at "none" when the current feed is a fibre the user can't see, and must not wipe it.
 */
export const feedPatch = ({ adding, before, chosen }) =>
  adding || (before ?? null) !== (chosen ?? null) ? { inputFiberId: chosen ?? null } : {}

/**
 * The building part of an EDIT: the building only when it changed (null removes it — the server then
 * clears wing and where), the wing / where / note when there is a building, else just the note.
 */
export function editPlaceBody({ before, building, place }) {
  const part = (before ?? null) !== (building?.id ?? null) ? { buildingId: building?.id ?? null } : {}
  return building ? { ...part, ...splitterPlaceBody(place) } : { ...part, note: (place.note ?? '').trim() || null }
}
