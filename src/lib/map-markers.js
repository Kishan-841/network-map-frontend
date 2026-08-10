/**
 * Shared building marker — a teardrop pin with a building glyph, white outline
 * and drop shadow so it reads clearly against a busy basemap (unlike a flat
 * dot). Returns the raw SVG plus dimensions/anchor; both map providers consume
 * it (Google as a data-URI icon, Leaflet as a divIcon).
 */
export function buildingPin({ color = '#22c55e', selected = false }) {
  const scale = selected ? 1.3 : 1
  const width = Math.round(40 * scale)
  const height = Math.round(50 * scale)

  // Halo ring behind the head marks the selected pin.
  const halo = selected
    ? `<circle cx="20" cy="19" r="17" fill="none" stroke="${color}" stroke-opacity="0.3" stroke-width="5"/>`
    : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 40 50">
  <defs>
    <filter id="bpsh" x="-50%" y="-20%" width="200%" height="170%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  ${halo}
  <path filter="url(#bpsh)" d="M20 48s15-16.8 15-28A15 15 0 1 0 5 20c0 11.2 15 28 15 28z" fill="${color}" stroke="#ffffff" stroke-width="3"/>
  <circle cx="20" cy="19" r="8.6" fill="#ffffff"/>
  <rect x="16" y="14.6" width="8" height="9.4" rx="0.8" fill="${color}"/>
  <g fill="#ffffff">
    <rect x="17.4" y="16.2" width="1.7" height="1.7"/>
    <rect x="20.9" y="16.2" width="1.7" height="1.7"/>
    <rect x="17.4" y="19.2" width="1.7" height="1.7"/>
    <rect x="20.9" y="19.2" width="1.7" height="1.7"/>
  </g>
</svg>`

  return { svg, width, height, anchorX: width / 2, anchorY: height }
}

export function pinDataUri(pin) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pin.svg)}`
}

const pinCache = new Map()

/**
 * Memoized pin + data-URI per color/selected pair. Marker icons repeat across
 * hundreds of buildings — caching lets the browser reuse one decoded image
 * instead of re-encoding identical SVGs on every marker (re)build.
 */
export function buildingPinCached({ color, selected = false }) {
  const key = `${color}|${selected}`
  let cached = pinCache.get(key)
  if (!cached) {
    const pin = buildingPin({ color, selected })
    cached = { ...pin, url: pinDataUri(pin) }
    pinCache.set(key, cached)
  }
  return cached
}

/**
 * Google Maps basemap style: hide the POI/business icon clutter (keeps place
 * labels and roads for orientation) so our building pins stand out.
 */
export const DECLUTTER_MAP_STYLE = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]
