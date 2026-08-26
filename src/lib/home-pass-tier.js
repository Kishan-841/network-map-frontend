/**
 * Presentation for the home-pass tiers. The BOUNDARIES live in the API
 * (backend/src/lib/home-pass-tier.js) and arrive on each building as
 * `homePassTier` — only the look is decided here, so a tier can never mean two
 * different things in two places.
 *
 * Colour is a single-hue ladder that darkens as the tier rises: an ordinal
 * scale, not four categorical hues. The name is always rendered beside it, so
 * the tier never depends on colour alone.
 */
export const TIER_LABEL = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
}

export const TIER_STYLE = {
  BRONZE: 'bg-fiber/10 text-fiber',
  SILVER: 'bg-fiber/20 text-fiber',
  GOLD: 'bg-fiber/30 text-fiber',
  PLATINUM: 'bg-fiber text-white',
}
