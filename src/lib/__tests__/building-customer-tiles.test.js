import { describe, it, expect } from 'vitest'
import { buildTiles, filterByTile, matchesTile } from '../building-customer-tiles'

const customers = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
const connections = {
  a: { state: 'online', weak: false },
  b: { state: 'online', weak: true },
  c: { state: 'offline' },
  d: { state: 'pending' },
}

describe('filterByTile', () => {
  it('keeps everything with no tile', () => {
    expect(filterByTile(customers, connections, null)).toEqual(customers)
  })
  it('filters by connection state', () => {
    expect(filterByTile(customers, connections, 'online').map((c) => c.id)).toEqual(['a', 'b'])
    expect(filterByTile(customers, connections, 'offline').map((c) => c.id)).toEqual(['c'])
    expect(filterByTile(customers, connections, 'pending').map((c) => c.id)).toEqual(['d'])
  })
  it('weak means connection.weak, whatever the state', () => {
    expect(filterByTile(customers, connections, 'weak').map((c) => c.id)).toEqual(['b'])
  })
  it('a customer without a connection matches no tile', () => {
    expect(matchesTile(undefined, 'online')).toBe(false)
  })
})

describe('buildTiles', () => {
  const counts = { online: 2, offline: 1, notSeen: 0, weak: 1, pending: 0 }
  it('shows only Total when the OLT feature is off', () => {
    expect(buildTiles({ total: 4, counts, connectionsOn: false, tileId: null })).toEqual([
      { id: 'total', label: 'Total', count: 4, active: true },
    ])
  })
  it('adds connection tiles, hides Not checked yet at zero, marks the active one', () => {
    const tiles = buildTiles({ total: 4, counts, connectionsOn: true, tileId: 'weak' })
    expect(tiles.map((t) => t.id)).toEqual(['total', 'online', 'offline', 'not_seen', 'weak'])
    expect(tiles.find((t) => t.active).id).toBe('weak')
  })
  it('shows Not checked yet when something is pending', () => {
    const tiles = buildTiles({ total: 4, counts: { ...counts, pending: 3 }, connectionsOn: true, tileId: null })
    expect(tiles.at(-1)).toMatchObject({ id: 'pending', count: 3 })
  })
})
