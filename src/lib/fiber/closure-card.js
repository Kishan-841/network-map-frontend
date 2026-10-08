import { CLOSURE_KINDS } from './constants'

/**
 * The editor's closure card, as data. Kept pure so the rule that matters —
 * a save never overwrites what the card never read — is testable.
 */

const text = (v) => (v === null || v === undefined ? '' : String(v))
const numberOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

/**
 * Form state from a closure (the API's GET /closures/:id, or the little the
 * line's point knows). Missing values read as "not recorded"; a closure with
 * no kind gets the first pill, as a fresh closure does.
 */
export function closureCardState(closure) {
  return {
    kind: closure?.kind || CLOSURE_KINDS[0].value,
    notes: closure?.notes ?? '',
    sheet: {
      fiberType: text(closure?.fiberType),
      tubeCount: text(closure?.tubeCount),
      inCoreCount: text(closure?.inCoreCount),
      outCoreCount: text(closure?.outCoreCount),
    },
    images: closure?.images ?? [],
  }
}

/**
 * What Save sends. `sheetKnown` / `imagesKnown` say whether the card has the
 * stored values: when it does not (an edit whose read failed), those fields
 * are left out so the API keeps what it has instead of being blanked. Photos
 * are only sent for a new closure when there are some.
 */
export function closureCardPayload({ kind, notes, sheet, images }, { mode = 'create', sheetKnown = true, imagesKnown = true } = {}) {
  const payload = { kind: kind || null, notes: notes.trim() || null }
  if (sheetKnown) {
    payload.fiberType = sheet.fiberType || null
    payload.tubeCount = numberOrNull(sheet.tubeCount)
    payload.inCoreCount = numberOrNull(sheet.inCoreCount)
    payload.outCoreCount = numberOrNull(sheet.outCoreCount)
  }
  if (imagesKnown && images && (mode === 'edit' || images.length > 0)) payload.images = images
  return payload
}
