import { describe, it, expect } from 'vitest'
import {
  parseFilters,
  toQuery,
  TILES,
  applyTile,
  tileActive,
  connLabel,
  checkedAgo,
  expiryTone,
  activeFilterCount,
  filterBuildings,
  buildingFilterLabel,
  shortAge,
  connShort,
  filterChips,
  EMPTY_FILTERS,
  rowOltDown,
  connTitle,
  visibleTiles,
  staleIds,
  mergeRows,
  safeBackHref,
  customerDetailHref,
} from '../customer-filters'

const NOW = new Date('2026-10-21T10:00:00Z').getTime()
const tile = (id) => TILES.find((t) => t.id === id)

describe('parseFilters / toQuery', () => {
  it('reads an empty URL as no filters, page 1, sorted by name', () => {
    const f = parseFilters(new URLSearchParams(''))
    expect(f.q).toBe('')
    expect(f.page).toBe(1)
    expect(f.sort).toBe('name')
    expect(activeFilterCount(f)).toBe(0)
  })

  it('round-trips a full filter set', () => {
    const qs = 'q=sharma&zoneId=z1&operator=Acme&conn=offline&weak=true&expiry=7d&autoRenewal=unset&sort=expiry&page=3'
    const f = parseFilters(new URLSearchParams(qs))
    expect(f).toMatchObject({ q: 'sharma', zoneId: 'z1', operator: 'Acme', conn: 'offline', weak: 'true', expiry: '7d', autoRenewal: 'unset', sort: 'expiry', page: 3 })
    expect(Object.fromEntries(toQuery(f))).toEqual(Object.fromEntries(new URLSearchParams(qs)))
  })

  it('drops empty and default values', () => {
    const f = parseFilters(new URLSearchParams('q=&conn=offline&page=1&sort=name'))
    expect(toQuery(f).toString()).toBe('conn=offline')
  })

  it('ignores values the API would not accept', () => {
    const f = parseFilters(new URLSearchParams('conn=bogus&weak=yes&expiry=1y&page=-4&sort=zzz'))
    expect(f).toMatchObject({ conn: '', weak: '', expiry: '', page: 1, sort: 'name' })
  })
})

describe('tiles', () => {
  it('has the tiles in order', () => {
    expect(TILES.map((t) => t.label)).toEqual(['Total', 'Online', 'Offline', 'Not seen', 'OLT not reachable', 'Weak signal', 'Expiring in 7 days'])
  })

  it('applies a tile on top of other filters, replacing the previous tile and resetting the page', () => {
    const base = parseFilters(new URLSearchParams('operator=Acme&conn=online&page=4'))
    const next = applyTile(base, tile('weak'))
    expect(next).toMatchObject({ operator: 'Acme', conn: '', weak: 'true', page: 1 })
    expect(applyTile(next, tile('total'))).toMatchObject({ operator: 'Acme', weak: '', conn: '', expiry: '' })
  })

  it('highlights exactly the active tile', () => {
    const f = applyTile(parseFilters(new URLSearchParams('')), tile('offline'))
    expect(TILES.filter((t) => tileActive(f, t)).map((t) => t.id)).toEqual(['offline'])
    const none = parseFilters(new URLSearchParams(''))
    expect(TILES.filter((t) => tileActive(none, t)).map((t) => t.id)).toEqual(['total'])
  })
})

describe('row labels', () => {
  it('labels a never-checked row and stored states', () => {
    expect(connLabel({ connState: null })).toBe('Never checked')
    expect(connLabel({ connState: 'online' })).toBe('Online')
    expect(connLabel({ connState: 'no_username' })).toBe('No username')
    expect(connLabel({ connState: 'not_seen', connLastSeen: null })).toBe('Not seen')
  })

  it('says how long ago a check was', () => {
    expect(checkedAgo(null, NOW)).toBe('')
    expect(checkedAgo(new Date(NOW - 30_000), NOW)).toBe('checked just now')
    expect(checkedAgo(new Date(NOW - 6 * 60_000), NOW)).toBe('checked 6 min ago')
    expect(checkedAgo(new Date(NOW - 2 * 3600_000), NOW)).toBe('checked 2 h ago')
    expect(checkedAgo(new Date(NOW - 3 * 86400_000), NOW)).toBe('checked 3 days ago')
  })

  it('tones the expiry date', () => {
    expect(expiryTone(null, NOW)).toBe(null)
    expect(expiryTone(new Date(NOW - 1000), NOW)).toBe('bad')
    expect(expiryTone(new Date(NOW + 3 * 86400_000), NOW)).toBe('warn')
    expect(expiryTone(new Date(NOW + 7 * 86400_000), NOW)).toBe('warn')
    expect(expiryTone(new Date(NOW + 8 * 86400_000), NOW)).toBe(null)
  })
})

describe('building picker helpers', () => {
  const list = [{ id: 'a', buildingName: 'Sai Heights' }, { id: 'b', buildingName: 'Green Park' }]
  it('filters by name, case-insensitively', () => {
    expect(filterBuildings(list, ' SAI ')).toEqual([list[0]])
    expect(filterBuildings(list, '')).toEqual(list)
    expect(filterBuildings(undefined, 'x')).toEqual([])
  })
  it('labels a stale id as Selected building', () => {
    expect(buildingFilterLabel(list, 'b')).toBe('Green Park')
    expect(buildingFilterLabel(list, 'zzz')).toBe('Selected building')
    expect(buildingFilterLabel(list, '')).toBe('')
  })
})

describe('shortAge / connShort', () => {
  it('shortens ages', () => {
    expect(shortAge(null, NOW)).toBe('')
    expect(shortAge(new Date(NOW - 20_000), NOW)).toBe('now')
    expect(shortAge(new Date(NOW - 18 * 60_000), NOW)).toBe('18m')
    expect(shortAge(new Date(NOW - 2 * 3600_000), NOW)).toBe('2h')
    expect(shortAge(new Date(NOW - 3 * 86400_000), NOW)).toBe('3d')
  })

  it('builds the one-line connection cell', () => {
    expect(connShort({ state: 'online', checkedAt: new Date(NOW - 18 * 60_000) }, NOW)).toEqual({ word: 'Online', note: '18m' })
    expect(connShort({ state: 'not_seen', lastSeen: '2026-10-05T08:00:00Z', checkedAt: new Date(NOW) }, NOW)).toEqual({ word: 'Not seen', note: 'since 5 Oct' })
    expect(connShort({ state: 'not_seen' }, NOW)).toEqual({ word: 'Not seen', note: '' })
    expect(connShort({ state: 'not_linked' }, NOW).word).toBe('Not linked')
    expect(connShort({}, NOW)).toEqual({ word: 'Never checked', note: '' })
  })
})

describe('filterChips', () => {
  const facets = { zones: [{ id: 'z1', name: 'MORYA INTERNET FTTH' }], buildings: [{ id: 'b1', buildingName: 'Capital Towers' }] }
  it('has no chips without filters', () => {
    expect(filterChips(EMPTY_FILTERS, facets)).toEqual([])
  })
  it('labels each active filter and clears just that one', () => {
    const chips = filterChips({ ...EMPTY_FILTERS, zoneId: 'z1', conn: 'offline', expiry: '7d', buildingId: 'b1', weak: 'true', q: 'raj', sort: 'expiry' }, facets)
    expect(chips.map((c) => c.label)).toEqual([
      'Zone: MORYA INTERNET FTTH',
      'Building: Capital Towers',
      'Connection: Offline',
      'Expires: within 7 days',
      'Weak signal',
    ])
    expect(chips[2].patch).toEqual({ conn: '' })
    expect(chips).toHaveLength(activeFilterCount({ ...EMPTY_FILTERS, zoneId: 'z1', conn: 'offline', expiry: '7d', buildingId: 'b1', weak: 'true' }))
  })
  it('handles stale ids and other facets', () => {
    const labels = filterChips({ ...EMPTY_FILTERS, zoneId: 'gone', buildingId: 'gone', planName: 'Gold', autoRenewal: 'unset' }, {}).map((c) => c.label)
    expect(labels).toEqual(['Zone: Selected zone', 'Building: Selected building', 'Plan: Gold', 'Auto renewal: Not set'])
  })
})

describe('OLT down + refresh helpers', () => {
  const NOW = Date.parse('2026-10-21T10:00:00Z')
  it('labels and titles OLT-down rows', () => {
    const row = { connState: 'not_seen', oltReachable: false, connOlt: 'OLT-9' }
    expect(rowOltDown(row)).toBe(true)
    expect(connLabel(row)).toBe('OLT not reachable')
    expect(connTitle(row, NOW)).toBe("Our OLT monitoring can't reach OLT-9 — this customer may be fine.")
    expect(connShort({ state: 'not_seen', oltReachable: false }).word).toBe('OLT not reachable')
    expect(connShort({ state: 'not_seen', oltReachable: null }).word).toBe('Not seen')
  })
  it('filter value, chip and tile', () => {
    const f = parseFilters(new URLSearchParams('conn=olt_down'))
    expect(f.conn).toBe('olt_down')
    expect(filterChips(f)[0].label).toBe('Connection: OLT not reachable')
    expect(visibleTiles({ oltDown: 0 }).map((t) => t.id)).not.toContain('olt_down')
    expect(visibleTiles({ oltDown: 2 }).map((t) => t.id)).toContain('olt_down')
    // stays visible while its own filter is active, even at 0
    expect(visibleTiles({ oltDown: 0 }, f).map((t) => t.id)).toContain('olt_down')
  })
  it('staleIds picks never-checked and older than 5 min', () => {
    const rows = [
      { id: 'a', connCheckedAt: null },
      { id: 'b', connCheckedAt: new Date(NOW - 2 * 60000).toISOString() },
      { id: 'c', connCheckedAt: new Date(NOW - 6 * 60000).toISOString() },
    ]
    expect(staleIds(rows, NOW)).toEqual(['a', 'c'])
    expect(staleIds(Array.from({ length: 80 }, (_, i) => ({ id: String(i) })), NOW)).toHaveLength(50)
  })
  it('mergeRows replaces by id and keeps the rest', () => {
    const out = mergeRows([{ id: 'a', n: 1 }, { id: 'b', n: 2 }], [{ id: 'b', n: 3 }])
    expect(out).toEqual([{ id: 'a', n: 1 }, { id: 'b', n: 3 }])
  })
})

describe('back navigation', () => {
  it('trusts only /customers paths', () => {
    expect(safeBackHref('/customers?conn=offline&page=2')).toBe('/customers?conn=offline&page=2')
    expect(safeBackHref('/customers')).toBe('/customers')
    expect(safeBackHref(undefined)).toBe('/customers')
    expect(safeBackHref('/buildings/1')).toBe('/customers')
    expect(safeBackHref('/customersX')).toBe('/customers')
    expect(safeBackHref('https://evil.example')).toBe('/customers')
    expect(safeBackHref('//evil.example')).toBe('/customers')
  })
  it('builds the detail link with an encoded back', () => {
    const h = customerDetailHref('c1', '/customers', 'conn=offline&page=2')
    expect(h).toBe('/customers/c1?back=%2Fcustomers%3Fconn%3Doffline%26page%3D2')
    expect(safeBackHref(decodeURIComponent(h.split('back=')[1]))).toBe('/customers?conn=offline&page=2')
    expect(customerDetailHref('c1', '/customers', '')).toBe('/customers/c1?back=%2Fcustomers')
  })
})
