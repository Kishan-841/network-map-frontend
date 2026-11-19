import { CLOSURE_KINDS } from './constants'
import { cablesPayload, cablesToForm } from './closure-cables'

/**
 * The editor's closure card, as data. Kept pure so the rule that matters —
 * a save never overwrites what the card never read — is testable.
 */

/**
 * Form state from a closure (the API's GET /closures/:id, or the little the
 * line's point knows). Missing values read as "not recorded". A NEW closure
 * starts on the first pill; a saved closure with no kind keeps none, so an
 * edit never writes a kind nobody chose.
 */
export function closureCardState(closure, { fresh = true } = {}) {
  return {
    kind: closure?.kind || (fresh ? CLOSURE_KINDS[0].value : ''),
    notes: closure?.notes ?? '',
    cables: cablesToForm(closure?.cables),
    images: closure?.images ?? [],
  }
}

/**
 * What Save sends. `sheetKnown` / `imagesKnown` say whether the card has the
 * stored values: when it does not (an edit whose read failed), those fields
 * are left out so the API keeps what it has instead of being blanked. Photos
 * are only sent for a new closure when there are some.
 */
export function closureCardPayload({ kind, notes, cables, images }, { mode = 'create', sheetKnown = true, imagesKnown = true } = {}) {
  const payload = { kind: kind || null, notes: notes.trim() || null }
  // The whole list replaces what is stored — so only when the card read it.
  if (sheetKnown) payload.cables = cablesPayload(cables)
  if (imagesKnown && images && (mode === 'edit' || images.length > 0)) payload.images = images
  return payload
}

const CARD_WIDTH = 320
/** The height a new card is assumed to need when it is lifted off the map's foot. */
const CARD_HEIGHT = 580

/**
 * Where a NEW closure's card sits on a desktop: on the tapped pixel, kept off
 * the right edge and lifted when tapped low — and never taller than the room
 * left below it, so Save stays on the map however many cables it holds.
 */
export function closureCardPlacement({ at, bounds }) {
  if (!bounds) return { left: at?.x, top: at?.y, maxHeight: null }
  const left = Math.max(8, Math.min(at.x, bounds.width - (CARD_WIDTH + 12)))
  if (!bounds.height) return { left, top: at.y, maxHeight: null }
  const top = Math.max(8, Math.min(at.y, bounds.height - CARD_HEIGHT - 8))
  return { left, top, maxHeight: bounds.height - top - 8 }
}

/**
 * The EDIT card's desktop placement: anchored above the mode pill like the
 * editor's other cards, but capped to the map and scrolling — In / Out cable
 * rows make it far taller than the small cards that placement was made for.
 */
export const CLOSURE_SHEET_ANCHORED =
  'lg:absolute lg:inset-x-3 lg:bottom-24 lg:mx-auto lg:max-h-[calc(100%-8rem)] lg:max-w-sm lg:rounded-card lg:pb-4'
