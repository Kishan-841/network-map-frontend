// Summary tiles of the building customers page: which live-connection tiles exist and which rows
// each one keeps. Pure (no React) so it can be tested.

/** Connection tiles, in display order. `countKey` is the key in the connections `counts` object. */
export const BUILDING_TILES = [
  { id: 'online', label: 'Online', countKey: 'online' },
  { id: 'offline', label: 'Offline', countKey: 'offline' },
  { id: 'not_seen', label: 'Not seen', countKey: 'notSeen' },
  { id: 'weak', label: 'Weak signal', countKey: 'weak' },
  { id: 'pending', label: 'Not checked yet', countKey: 'pending', onlyWhenPositive: true },
]

/** Does this customer's live connection belong under the tile? `connection` may be undefined. */
export function matchesTile(connection, tileId) {
  if (!tileId) return true
  if (!connection) return false
  if (tileId === 'weak') return connection.weak === true
  return connection.state === tileId
}

/** Keep the customers under a tile (all of them with no tile). `connections` is keyed by customer id. */
export function filterByTile(customers, connections, tileId) {
  if (!tileId) return customers
  return customers.filter((c) => matchesTile(connections?.[c.id], tileId))
}

/** Tiles to show: Total first, then the connection tiles with their counts (none while disabled). */
export function buildTiles({ total, counts, connectionsOn, tileId }) {
  const tiles = [{ id: 'total', label: 'Total', count: total, active: !tileId }]
  if (!connectionsOn || !counts) return tiles
  for (const t of BUILDING_TILES) {
    const count = counts[t.countKey] ?? 0
    if (t.onlyWhenPositive && count <= 0) continue
    tiles.push({ id: t.id, label: t.label, count, active: tileId === t.id })
  }
  return tiles
}
