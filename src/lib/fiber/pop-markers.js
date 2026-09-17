import { POINT_COLORS } from './constants'

const coord = (value, limit) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

/**
 * POPs → what the map needs to draw them. A POP without a usable position is
 * left out rather than drawn at (0, 0) in the Gulf of Guinea.
 */
export function popMarkerData(pops) {
  return (pops ?? []).flatMap((pop) => {
    const lat = coord(pop.latitude, 90)
    const lng = coord(pop.longitude, 180)
    if (lat === null || lng === null) return []
    return [
      {
        id: pop.id,
        name: pop.name,
        notes: pop.notes ?? null,
        oltCount: pop.olts?.length ?? 0,
        position: { lat, lng },
      },
    ]
  })
}

export const POP_ICON_SIZE = 34

/**
 * The POP pin: Lucide's `server` glyph, white, on a rounded square in the POP
 * colour. A data URL so the map needs no image file and no extra request.
 */
export function popIconUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${POP_ICON_SIZE}" height="${POP_ICON_SIZE}" viewBox="0 0 34 34">
<rect x="2" y="2" width="30" height="30" rx="9" fill="${POINT_COLORS.POP}" stroke="#ffffff" stroke-width="2.5"/>
<g transform="translate(8 8) scale(0.75)" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
<line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>
</g></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
