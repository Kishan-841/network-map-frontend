import { describe, expect, it } from 'vitest'
import { fiberChoices } from '../switch'

const f = (id, name, zone, coreCount = 12) => ({ id, name, coreCount, zone: zone ? { name: zone } : null })
const fibers = [
  f('a', '100G - CITY CENTER', 'SHRINATH HINJAWADI'),
  f('b', '2091, VijayNagar to VijayNagar-circle', 'GATEWAY NP'),
  f('c', '23 to Ignite-study-point', 'GATEWAY NP'),
  f('d', '4 STAR - 7 STAR', 'SHRINATH HINJAWADI', 6),
]

describe('fiberChoices', () => {
  it('leaves out the fibre being edited', () => {
    expect(fiberChoices(fibers, '', 'a').map((x) => x.id)).not.toContain('a')
  })

  it('matches the name or the zone, ignoring case', () => {
    expect(fiberChoices(fibers, 'vijaynagar', null).map((x) => x.id)).toEqual(['b'])
    expect(fiberChoices(fibers, 'gateway', null).map((x) => x.id)).toEqual(['c', 'b']) // 23 before 2091
  })

  it('sorts by name with numbers in number order', () => {
    expect(fiberChoices(fibers, '', null).map((x) => x.id)).toEqual(['d', 'c', 'a', 'b'])
  })

  it('caps the list and says how many matched', () => {
    const many = Array.from({ length: 80 }, (_, i) => f(`x${i}`, `Fibre ${i}`, 'Z'))
    const out = fiberChoices(many, 'fibre', null, 50)
    expect(out).toHaveLength(50)
    expect(out.total).toBe(80)
  })

  it('copes with a missing name or zone', () => {
    expect(fiberChoices([f('n', null, null)], '', null)).toHaveLength(1)
  })
})
