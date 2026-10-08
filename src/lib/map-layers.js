/**
 * How many legend layers the reader has switched off — drives the dot on the
 * collapsed Layers button, so a filter folded out of sight is not forgotten.
 *
 * Live / Not live are filters INSIDE Buildings, so with Buildings off they are
 * not counted again. A layer the map does not have (`undefined`, e.g. no zones
 * drawn) cannot be hidden. Fiber is left out on purpose: it starts off, so
 * "off" there is the default, not something the reader did.
 */
export function hiddenLayerCount({ buildings, live, notLive, society, zones, pops }) {
  const insideBuildings = buildings === false ? [] : [live, notLive, society]
  return [buildings, ...insideBuildings, zones, pops].filter((shown) => shown === false).length
}

/**
 * Which legend row a building pin belongs to. A society (approved from Society
 * permissions) is its own group whether or not it is live — its pin still
 * wears the live / not-live colour, but switching Live or Not live off leaves
 * societies alone, and the Society row shows or hides exactly those.
 */
export function buildingGroup(building) {
  if (building?.source === 'PERMISSION') return 'society'
  return building?.isLive ? 'live' : 'notLive'
}

/** Pins per legend row; each building is counted once. */
export function countBuildingGroups(buildings) {
  const counts = { live: 0, notLive: 0, society: 0 }
  for (const b of buildings ?? []) counts[buildingGroup(b)] += 1
  return counts
}
