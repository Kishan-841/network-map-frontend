// How zone boundaries and names are drawn on the Google maps, per base layer.
// Zones are context, not content: they should be findable without shouting.
// Every map draws them the same quiet way — a barely-there fill and a thin
// dotted edge. On the plain map the calm palette reads fine; satellite /
// hybrid ground is tan, brown and green, so there the dots use cool hues
// (blue / violet / purple) and the name is white text with a light shadow.
import { ZONE_COLORS } from './constants'

export const isImageryLayer = (layer) => layer === 'satellite' || layer === 'hybrid'

/**
 * Cool hues for imagery — the opposite of the tan, brown and green that
 * satellite ground is made of — at medium strength, not neon.
 */
export const IMAGERY_ZONE_COLORS = [
  '#1E90FF', // blue
  '#8B5CF6', // violet
  '#00B4E6', // sky
  '#A855F7', // purple
  '#6366F1', // indigo
  '#C13FE0', // magenta-purple
]

/** Everything a map needs to draw zone number `index` on `layer`. */
export function zoneLook(layer, index) {
  if (!isImageryLayer(layer)) {
    const color = ZONE_COLORS[index % ZONE_COLORS.length]
    return { color, fillOpacity: 0.1, dotScale: 1.6, labelColor: color, labelClass: undefined }
  }
  const color = IMAGERY_ZONE_COLORS[index % IMAGERY_ZONE_COLORS.length]
  return { color, fillOpacity: 0.1, dotScale: 2, labelColor: '#ffffff', labelClass: 'zone-name-soft' }
}

/** A Google Maps Marker label for the zone's name. */
export function zoneLabel(name, look) {
  return {
    text: String(name).toUpperCase(),
    color: look.labelColor,
    fontSize: '11px',
    fontWeight: '600',
    ...(look.labelClass ? { className: look.labelClass } : {}),
  }
}

/**
 * The zone's drawn shape (browser only): a faint fill and a dotted edge
 * (Google polygons have no native dash, so the edge is a polyline of
 * repeated dot symbols). Returns the overlays so the caller can remove them.
 */
export function zoneShapeOverlays(map, path, look, zIndex = 1) {
  return [
    new google.maps.Polygon({
      map,
      paths: path,
      strokeOpacity: 0,
      fillColor: look.color,
      fillOpacity: look.fillOpacity,
      clickable: false,
      zIndex,
    }),
    new google.maps.Polyline({
      map,
      path: [...path, path[0]], // close the ring
      strokeOpacity: 0,
      clickable: false,
      zIndex,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: look.color,
            fillOpacity: 1,
            strokeOpacity: 0,
            scale: look.dotScale,
          },
          offset: '0',
          repeat: '9px',
        },
      ],
    }),
  ]
}
