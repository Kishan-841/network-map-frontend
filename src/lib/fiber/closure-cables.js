import { fiberTypeLabel } from './constants'

/**
 * A closure's In / Out cables as the forms hold them: every field a string,
 * plus a `key` so React keeps each row's inputs when one above it is removed.
 */

let nextKey = 0
const newKey = () => `cable-${++nextKey}`
const text = (v) => (v === null || v === undefined ? '' : String(v))

/** A blank row on one side. */
export const emptyCable = (direction) => ({ key: newKey(), direction, cableType: '', coreCount: '', cableTag: '' })

/** Stored cables (from the API) → form rows. */
export const cablesToForm = (cables) =>
  (cables ?? []).map((c) => ({
    key: newKey(),
    direction: c.direction,
    cableType: text(c.cableType),
    coreCount: text(c.coreCount),
    cableTag: text(c.cableTag),
  }))

/** Form rows → what the API takes. A row left completely blank is dropped. */
export const cablesPayload = (rows) =>
  rows
    .map((r) => ({
      direction: r.direction,
      cableType: r.cableType || null,
      coreCount: r.coreCount === '' ? null : Number(r.coreCount),
      cableTag: r.cableTag.trim() || null,
    }))
    .filter((c) => c.cableType || c.coreCount != null || c.cableTag)

/** Stored cables split by side, each in its saved order. */
export const cablesBySide = (cables) => ({
  IN: (cables ?? []).filter((c) => c.direction === 'IN'),
  OUT: (cables ?? []).filter((c) => c.direction === 'OUT'),
})

/** One line for the read view: "Main SF · 12 core · FIB-22". */
export function cableSummary(cable) {
  const parts = [
    fiberTypeLabel(cable.cableType),
    cable.coreCount != null ? `${cable.coreCount} core` : null,
    cable.cableTag || null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Not recorded'
}
