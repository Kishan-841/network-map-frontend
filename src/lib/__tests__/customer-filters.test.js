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
  it('has the six tiles in order', () => {
    expect(TILES.map((t) => t.label)).toEqual(['Total', 'Online', 'Offline', 'Not seen', 'Weak signal', 'Expiring in 7 days'])
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
