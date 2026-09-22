import { describe, it, expect } from 'vitest'
import { oltOptionsFromPops, zonesOfSelection } from '../olt-mapping'

const pops = [
  { id: 'p1', name: 'POP-A', zone: { id: 'zA', name: 'Zone A' }, olts: [{ id: 'o1', name: 'OLT-01', ponPortCount: 16 }, { id: 'o2', name: 'OLT-02', ponPortCount: 8 }] },
  { id: 'p2', name: 'POP-B', zone: { id: 'zB', name: 'Zone B' }, olts: [{ id: 'o3', name: 'OLT-03', ponPortCount: 16 }] },
  { id: 'p3', name: 'POP-C', zone: null, olts: [{ id: 'o4', name: 'OLT-04', ponPortCount: 4 }] },
]

describe('oltOptionsFromPops', () => {
  it('flattens every OLT with its zone, sorted by name', () => {
    const all = oltOptionsFromPops(pops)
    expect(all.map((o) => o.name)).toEqual(['OLT-01', 'OLT-02', 'OLT-03', 'OLT-04'])
    expect(all[0]).toMatchObject({ id: 'o1', ponPortCount: 16, zoneId: 'zA', zoneName: 'Zone A' })
  })

  it('narrows to one zone when a zoneId is given', () => {
    expect(oltOptionsFromPops(pops, 'zB').map((o) => o.name)).toEqual(['OLT-03'])
    expect(oltOptionsFromPops(pops, 'zA')).toHaveLength(2)
  })
})

describe('zonesOfSelection', () => {
  const rows = [
    { id: 'b1', zone: { id: 'zA', name: 'Zone A' } },
    { id: 'b2', zone: { id: 'zA', name: 'Zone A' } },
    { id: 'b3', zone: { id: 'zB', name: 'Zone B' } },
    { id: 'b4', zone: null },
  ]
  it('returns one zone when the selection shares it', () => {
    expect(zonesOfSelection(rows, ['b1', 'b2'])).toEqual([{ id: 'zA', name: 'Zone A' }])
  })
  it('returns both zones when the selection spans them', () => {
    expect(zonesOfSelection(rows, new Set(['b1', 'b3'])).map((z) => z.id).sort()).toEqual(['zA', 'zB'])
  })
  it('reads a zoneless building as its own group', () => {
    expect(zonesOfSelection(rows, ['b4'])).toEqual([{ id: null, name: 'No zone' }])
  })
})
