import { FIBER_TYPE_COLORS } from '@/lib/constants'

export const CORE_COUNTS = [2, 4, 6, 12, 24, 48]
/** Line colour on the map IS the core count (phase-1 palette, keyed by number now). */
export const coreColor = (n) => FIBER_TYPE_COLORS[`${n} core`] ?? FIBER_TYPE_COLORS['2 core']

export const RATIO_LABELS = { R1_2: '1:2', R1_4: '1:4', R1_8: '1:8', R1_16: '1:16' }
/** Marker colours are fixed per point type — never by core count. */
export const POINT_COLORS = { POP: '#7c3aed', CLOSURE: '#0e7569', SPLITTER: '#f97316', WAYPOINT: '#64748b', BUILDING: '#22c55e' }
