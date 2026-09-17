import { POINT_COLORS } from './constants'

/**
 * Typed point icons for the fiber map — cached raster data-URI SVGs on an
 * 18x18 viewBox, following buildingDotIcon's cache pattern (image markers
 * stay cheap during zoom animation, unlike vector SymbolPath markers which
 * redraw every frame).
 */

const KIND_SHAPES = {
  POP: (color) => `<rect x="3" y="3" width="12" height="12" rx="2" fill="${color}" stroke="#ffffff" stroke-width="2"/>`,
  CLOSURE: (color) =>
    `<circle cx="9" cy="9" r="6" fill="${color}" stroke="#ffffff" stroke-width="2"/><circle cx="9" cy="9" r="2" fill="#ffffff"/>`,
  SPLITTER: (color) => `<polygon points="9,1 17,9 9,17 1,9" fill="${color}" stroke="#ffffff" stroke-width="2"/>`,
  WAYPOINT: (color) => `<circle cx="9" cy="9" r="4" fill="${color}" fill-opacity="0.9" stroke="#ffffff" stroke-width="1.5"/>`,
  BUILDING: (color) =>
    `<circle cx="9" cy="9" r="6" fill="${color}" stroke="#ffffff" stroke-width="2"/><rect x="6.5" y="6" width="5" height="6" rx="0.6" fill="#ffffff"/>`,
}

const VALID_KINDS = new Set(['POP', 'CLOSURE', 'SPLITTER', 'WAYPOINT', 'BUILDING', 'SNAP_RING'])

const iconCache = new Map()

export function typedMarkerIcon(kind, { selected = false, size = 18 } = {}) {
  if (!VALID_KINDS.has(kind)) {
    throw new Error(`Unknown marker kind: ${kind}`)
  }

  const key = `${kind}|${selected}|${size}`
  let cached = iconCache.get(key)
  if (cached) return cached

  let body
  let halo = ''
  if (kind === 'SNAP_RING') {
    // No halo even when selected — the dashed ring is itself the highlight.
    body = `<circle cx="9" cy="9" r="8" fill="none" stroke="#14b8a6" stroke-width="2" stroke-dasharray="3,2"/>`
  } else {
    const color = POINT_COLORS[kind]
    if (selected) {
      halo = `<circle cx="9" cy="9" r="8" fill="${color}" fill-opacity="0.25"/>`
    }
    body = KIND_SHAPES[kind](color)
  }

  const renderedSize = Math.round(selected ? size * 1.3 : size)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderedSize}" height="${renderedSize}" viewBox="0 0 18 18">${halo}${body}</svg>`

  cached = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size: renderedSize,
    anchor: { x: renderedSize / 2, y: renderedSize / 2 },
  }
  iconCache.set(key, cached)
  return cached
}

/**
 * Google's own centred marker label. Still the right tool for a ZONE name,
 * which labels an area rather than a symbol; typed point markers use
 * `labelBadgeIcon` instead (a centred label buries the symbol under it).
 */
export function markerLabel(text) {
  return { text, color: '#ffffff', fontSize: '11px', fontWeight: '700', className: 'fiber-zone-label' }
}

/**
 * Readable text badge for a typed marker — a white pill with a downward
 * pointer, drawn as its own cached data-URI SVG and hung on a companion
 * marker ABOVE the symbol.
 *
 * Google's marker `label` centres its text ON the icon, which buries the teal
 * closure circle / orange splitter diamond under the code and leaves both
 * unreadable on satellite imagery. A pill that floats clear of the symbol
 * solves both at once, and (unlike a label) it carries its own background.
 *
 * Geometry: an 11 px bold line, 8 px side padding, a 22 px pill and a 5 px
 * pointer (27 px tall in all). The anchor sits 11 px BELOW the image, so the
 * pointer tip floats 11 px above the position — clear of an 18 px symbol's
 * top edge (9 px) with 2 px to spare.
 */
const BADGE_PILL_HEIGHT = 22
const BADGE_POINTER = 5
const BADGE_HEIGHT = BADGE_PILL_HEIGHT + BADGE_POINTER
const BADGE_MIN_WIDTH = 28
const BADGE_CHAR_WIDTH = 6.6 // 11px bold Inter averages a shade under 6.6px/char
const BADGE_SIDE_PADDING = 8
const BADGE_LIFT = 11 // pointer tip floats this far above the symbol's centre

const BADGE_TONES = {
  light: { fill: '#ffffff', stroke: '#0f172a', ink: '#0f172a' },
  // The hover highlight: inverted, so a badge summoned by the pointer never
  // reads as "one more label that was always there".
  dark: { fill: '#0f172a', stroke: '#ffffff', ink: '#ffffff' },
}

/** The SVG is inlined into a data URI — text has to be XML-safe first. */
const escapeXml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const badgeCache = new Map()

export function labelBadgeIcon(text, { tone = 'light' } = {}) {
  const key = `${tone}|${text}`
  let cached = badgeCache.get(key)
  if (cached) return cached

  const { fill, stroke, ink } = BADGE_TONES[tone] ?? BADGE_TONES.light
  const width = Math.max(BADGE_MIN_WIDTH, Math.round(String(text).length * BADGE_CHAR_WIDTH) + BADGE_SIDE_PADDING * 2)
  const cx = width / 2
  // The pointer starts INSIDE the pill so its opaque fill covers the pill's
  // bottom hairline; only the 5 px below the pill edge is ever visible.
  const pointerTop = BADGE_PILL_HEIGHT - 2

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BADGE_HEIGHT}" viewBox="0 0 ${width} ${BADGE_HEIGHT}">` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${BADGE_PILL_HEIGHT - 1}" rx="8" fill="${fill}" fill-opacity="0.96" stroke="${stroke}" stroke-opacity="0.12" stroke-width="1"/>` +
    `<path d="M${cx - 5} ${pointerTop} L${cx} ${BADGE_HEIGHT} L${cx + 5} ${pointerTop} Z" fill="${fill}" fill-opacity="0.96"/>` +
    `<text x="${cx}" y="15" text-anchor="middle" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="11" font-weight="700" fill="${ink}">${escapeXml(text)}</text>` +
    `</svg>`

  cached = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    width,
    height: BADGE_HEIGHT,
    anchor: { x: cx, y: BADGE_HEIGHT + BADGE_LIFT },
  }
  badgeCache.set(key, cached)
  return cached
}
