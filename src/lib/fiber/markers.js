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

export function markerLabel(text) {
  return { text, color: '#ffffff', fontSize: '11px', fontWeight: '700', className: 'fiber-zone-label' }
}
