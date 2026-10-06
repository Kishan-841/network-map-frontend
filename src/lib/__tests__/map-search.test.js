import { describe, expect, it } from 'vitest'
import { matchBuildings, MIN_SEARCH_CHARS, searchPinFrom } from '../map-search'

const b = (id, buildingName, formattedAddress, zone) => ({
  id,
  buildingName,
  formattedAddress,
  zone: zone ? { name: zone } : null,
})

const BUILDINGS = [
  b('1', 'Tower B', 'Kothrud, Pune', 'Kothrud'),
  b('2', 'Sunrise Heights', 'Baner Road, Pune', 'Baner'),
  b('3', 'Apna Bazar', 'Wakad', null),
  b('4', 'Tower A', 'Kothrud, Pune', 'Kothrud'),
]

describe('matchBuildings', () => {
  it('matches name, address and zone, every word in any order', () => {
    expect(matchBuildings(BUILDINGS, 'kothrud tower').map((x) => x.id)).toEqual(['1', '4'])
    expect(matchBuildings(BUILDINGS, 'BANER').map((x) => x.id)).toEqual(['2'])
    expect(matchBuildings(BUILDINGS, 'wakad').map((x) => x.id)).toEqual(['3'])
  })

  it('needs the same minimum as the place search', () => {
    expect(MIN_SEARCH_CHARS).toBe(3)
    expect(matchBuildings(BUILDINGS, 'to')).toEqual([])
    expect(matchBuildings(BUILDINGS, '   ')).toEqual([])
  })

  it('caps the list and tolerates missing input', () => {
    expect(matchBuildings(BUILDINGS, 'pune', 2)).toHaveLength(2)
    expect(matchBuildings(undefined, 'pune')).toEqual([])
    expect(matchBuildings(BUILDINGS, null)).toEqual([])
  })
})

describe('searchPinFrom', () => {
  it('builds a pin from a picked place', () => {
    expect(
      searchPinFrom({ primaryText: 'Shaniwar Wada', secondaryText: 'Pune' }, { latitude: 18.5195, longitude: 73.8553 }),
    ).toEqual({ latitude: 18.5195, longitude: 73.8553, label: 'Shaniwar Wada, Pune' })
  })

  it('refuses a place without usable coordinates', () => {
    expect(searchPinFrom({ primaryText: 'X' }, { latitude: null, longitude: 73 })).toBeNull()
    expect(searchPinFrom({ primaryText: 'X' }, { latitude: Number.NaN, longitude: 73 })).toBeNull()
    expect(searchPinFrom({ primaryText: 'X' }, null)).toBeNull()
  })
})
