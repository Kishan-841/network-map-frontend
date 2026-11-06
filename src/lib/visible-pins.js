import Supercluster from 'supercluster'

// Which building bubbles and pins the map should draw right now. Pure — no
// Google Maps — so GoogleBuildingsMap only has to turn the answer into
// markers. Spec: docs/superpowers/specs/2026-11-06-map-visible-pins-design.md
//
// The map used to create one Google marker per building (~1,900 today,
// ~17,000 at 10×) and freeze while doing it. Now it draws only what is in
// view: a few dozen bubbles zoomed out, a few hundred pins zoomed in.

/** Today's MarkerClusterer settings: no bubbles at zoom 17 and closer. */
export const CLUSTER_OPTIONS = { radius: 60, maxZoom: 16, minPoints: 2 }

/** The clustering index for a list of buildings (≈20 ms for 17k). */
export function buildIndex(buildings) {
  const index = new Supercluster(CLUSTER_OPTIONS)
  index.load(
    (buildings ?? []).map((building) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [building.longitude, building.latitude] },
      properties: { building },
    })),
  )
  return index
}

/** The visible area grown by `fraction` of its span on every side, so a short pan draws nothing new. */
export function padBounds({ west, south, east, north }, fraction = 0.25) {
  const dx = (east - west) * fraction
  const dy = (north - south) * fraction
  return { west: west - dx, south: south - dy, east: east + dx, north: north + dy }
}

const fixed = (n) => Number(n).toFixed(6)

/**
 * Bubbles and pins inside `bounds` at `zoom`. A bubble's key is its zoom,
 * position and count — not supercluster's id, which changes whenever the
 * index is rebuilt (the Sales map refreshes every 60 s) and would redraw
 * every bubble for nothing.
 */
export function visibleItems(index, { west, south, east, north }, zoom) {
  const z = Math.round(zoom)
  return index.getClusters([west, south, east, north], z).map((feature) => {
    const [lng, lat] = feature.geometry.coordinates
    if (feature.properties.cluster) {
      const count = feature.properties.point_count
      return {
        key: `c:${z}:${fixed(lng)},${fixed(lat)}:${count}`,
        kind: 'cluster',
        clusterId: feature.properties.cluster_id,
        count,
        latitude: lat,
        longitude: lng,
      }
    }
    const { building } = feature.properties
    return { key: `b:${building.id}`, kind: 'pin', building }
  })
}

/** The box around every building in a bubble — a bubble click fits the map to it. */
export function clusterBounds(index, clusterId) {
  const leaves = index.getLeaves(clusterId, Infinity)
  const bounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }
  for (const leaf of leaves) {
    const [lng, lat] = leaf.geometry.coordinates
    bounds.west = Math.min(bounds.west, lng)
    bounds.east = Math.max(bounds.east, lng)
    bounds.south = Math.min(bounds.south, lat)
    bounds.north = Math.max(bounds.north, lat)
  }
  return bounds
}

/** What to create, leave alone and remove to go from the drawn keys to `items`. */
export function reconcile(prevKeys, items) {
  const prev = new Set(prevKeys)
  const next = new Set()
  const add = []
  const keep = []
  for (const item of items) {
    next.add(item.key)
    if (prev.has(item.key)) keep.push(item.key)
    else add.push(item)
  }
  const remove = [...prev].filter((key) => !next.has(key))
  return { add, keep, remove }
}
