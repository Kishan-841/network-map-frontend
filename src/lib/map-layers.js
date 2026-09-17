/**
 * How many legend layers the reader has switched off — drives the dot on the
 * collapsed Layers button, so a filter folded out of sight is not forgotten.
 *
 * Live / Not live are filters INSIDE Buildings, so with Buildings off they are
 * not counted again. A layer the map does not have (`undefined`, e.g. no zones
 * drawn) cannot be hidden. Fiber is left out on purpose: it starts off, so
 * "off" there is the default, not something the reader did.
 */
export function hiddenLayerCount({ buildings, live, notLive, zones, pops }) {
  const insideBuildings = buildings === false ? [] : [live, notLive]
  return [buildings, ...insideBuildings, zones, pops].filter((shown) => shown === false).length
}
