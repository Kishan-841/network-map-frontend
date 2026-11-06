import { describe, expect, it } from 'vitest'
import { matchClosures } from '../closure-pick'

const closures = [
  { id: '1', code: 'JC-0001', building: null },
  { id: '2', code: 'JC-0012', building: { buildingName: 'Yashone Towers' } },
  { id: '3', code: 'JC-0120', building: { buildingName: 'Green Park' } },
  { id: '4', code: 'JC-1200', building: null },
]

describe('matchClosures', () => {
  it('needs at least one character', () => {
    expect(matchClosures(closures, '   ')).toEqual([])
  })

  it('matches the code, ignoring case and the dash', () => {
    expect(matchClosures(closures, 'jc0012').map((c) => c.id)).toEqual(['2'])
    expect(matchClosures(closures, '12').map((c) => c.id)).toEqual(['2', '3', '4'])
  })

  it('matches the building name', () => {
    expect(matchClosures(closures, 'yash').map((c) => c.id)).toEqual(['2'])
  })

  it('puts codes that start with the query first', () => {
    expect(matchClosures(closures, '120').map((c) => c.id)).toEqual(['3', '4'])
    expect(matchClosures(closures, 'jc-12').map((c) => c.id)).toEqual(['4'])
  })

  it('caps the list', () => {
    expect(matchClosures(closures, 'jc', 2)).toHaveLength(2)
  })
})
