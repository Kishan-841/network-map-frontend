import { FIBER_TYPE_COLORS } from '@/lib/constants'

export const CORE_COUNTS = [2, 4, 6, 12, 24, 48]
/** Line colour on the map IS the core count (phase-1 palette, keyed by number now). */
export const coreColor = (n) => FIBER_TYPE_COLORS[`${n} core`] ?? FIBER_TYPE_COLORS['2 core']

export const RATIO_LABELS = { R1_2: '1:2', R1_4: '1:4', R1_6: '1:6', R1_8: '1:8', R1_16: '1:16' }
/** The closure bodies actually used in the field — the only three offered. */
/**
 * Closure types, by the names the field uses. A tiffin takes 2 ways and a
 * compass 4, so the label says so — that is what decides which box goes on a
 * pole. The stored value stays the plain name: closures recorded before this
 * keep reading correctly, and nothing had to be migrated.
 */
/**
 * What kind of cable a route is, in the field's words. Stored in `cableType`;
 * the label is what the sheet calls it.
 */
export const FIBER_TYPES = [
  { value: 'MAIN_SF', label: 'Main SF' },
  { value: 'SUB_SF', label: 'Sub-SF' },
  { value: 'DROP_CABLE', label: 'Drop cable' },
]
export const fiberTypeLabel = (value) =>
  value ? (FIBER_TYPES.find((t) => t.value === value)?.label ?? value) : null

export const CLOSURE_KINDS = [
  { value: 'Jumbo', label: 'Jumbo' },
  { value: 'Tiffin', label: '2 way tiffin' },
  { value: 'Compass', label: '4 way compass' },
  { value: 'FDC', label: 'FDC' },
  { value: 'PatchPanel', label: 'Patch panel' },
]

/** Tubes in the cable a closure sits on. 0 is a real answer. */
export const TUBE_COUNTS = [0, 1, 2, 3, 4]

/** A stored kind as it should read on screen; anything unknown reads as it is. */
export const closureKindLabel = (kind) =>
  kind ? (CLOSURE_KINDS.find((k) => k.value === kind)?.label ?? kind) : null
export const FIBER_TYPE_LABELS = { MAIN: 'Main', SUB: 'Sub' }
/** Marker colours are fixed per point type — never by core count. */
export const POINT_COLORS = { POP: '#7c3aed', CLOSURE: '#0e7569', SPLITTER: '#f97316', WAYPOINT: '#64748b', BUILDING: '#22c55e' }
