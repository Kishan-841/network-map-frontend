/** Space between the picked point and the coordinate card, px. */
export const CARD_GAP = 14
const EDGE = 8 // px kept clear of the map's edges

/**
 * Where the "what's here" coordinate card sits: centred above the point the
 * user right-clicked / pressed and held, dropping below it near the top edge,
 * and clamped so it never falls off either side of the map.
 * All values are px inside the map container.
 */
export function coordinateCardPlacement(point, map, card) {
  const maxLeft = Math.max(EDGE, map.width - card.width - EDGE)
  const left = Math.min(Math.max(point.x - card.width / 2, EDGE), maxLeft)
  const above = point.y - CARD_GAP - card.height
  const top = above >= EDGE ? above : point.y + CARD_GAP
  return { left, top }
}
