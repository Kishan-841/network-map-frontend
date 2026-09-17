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

// Where the pin sits on the POP's coordinates: the triangle's centroid (the
// average of its three corners), so the shape is centred on the site rather
// than hanging off its apex or its base.
export const POP_ICON_ANCHOR = { x: 17, y: 21 }

/**
 * The POP pin: a solid triangle in the POP colour with a white outline, so it
 * reads against satellite imagery as well as the road map. A data URL so the
 * map needs no image file and no extra request.
 */
export function popIconUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${POP_ICON_SIZE}" height="${POP_ICON_SIZE}" viewBox="0 0 34 34">
<polygon points="17,4 31,30 3,30" fill="${POINT_COLORS.POP}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
