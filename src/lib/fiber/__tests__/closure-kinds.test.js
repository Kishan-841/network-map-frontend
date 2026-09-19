import { describe, it, expect } from 'vitest'
import { CLOSURE_KINDS, closureKindLabel } from '../constants'

describe('closure kinds', () => {
  it('stores the plain name for every kind it offers', () => {
    expect(CLOSURE_KINDS.every((k) => typeof k.value === 'string' && k.value === k.value.trim())).toBe(true)
  })

  it('names the two by how many ways they take', () => {
    expect(CLOSURE_KINDS.find((k) => k.value === 'Tiffin').label).toBe('2 way tiffin')
    expect(CLOSURE_KINDS.find((k) => k.value === 'Compass').label).toBe('4 way compass')
  })

  it('leaves Jumbo alone — it has no way count to give', () => {
    expect(CLOSURE_KINDS.find((k) => k.value === 'Jumbo').label).toBe('Jumbo')
  })

  it('labels a stored value wherever a closure is shown', () => {
    expect(closureKindLabel('Tiffin')).toBe('2 way tiffin')
    expect(closureKindLabel('Compass')).toBe('4 way compass')
  })

  it('reads a value it does not know back unchanged, so older closures still say something', () => {
    expect(closureKindLabel('handhole')).toBe('handhole')
    expect(closureKindLabel(null)).toBe(null)
    expect(closureKindLabel('')).toBe(null)
  })
})

describe('fiber types', () => {
  it('names the three kinds of cable the sheet asks for', async () => {
    const { FIBER_TYPES, fiberTypeLabel } = await import('../constants')
    expect(FIBER_TYPES.map((t) => t.value)).toEqual(['MAIN_SF', 'SUB_SF', 'DROP_CABLE'])
    expect(fiberTypeLabel('MAIN_SF')).toBe('Main SF')
    expect(fiberTypeLabel('SUB_SF')).toBe('Sub-SF')
    expect(fiberTypeLabel('DROP_CABLE')).toBe('Drop cable')
  })

  it('reads an unknown value back and says nothing for none', async () => {
    const { fiberTypeLabel } = await import('../constants')
    expect(fiberTypeLabel('ribbon')).toBe('ribbon')
    expect(fiberTypeLabel(null)).toBeNull()
  })
})

describe('the closure survey sheet', () => {
  it('offers the five boxes the field fits', async () => {
    const { CLOSURE_KINDS } = await import('../constants')
    expect(CLOSURE_KINDS.map((k) => k.value)).toEqual([
      'Jumbo',
      'Tiffin',
      'Compass',
      'FDC',
      'PatchPanel',
    ])
  })

  it('labels the two newcomers plainly', async () => {
    const { closureKindLabel } = await import('../constants')
    expect(closureKindLabel('FDC')).toBe('FDC')
    expect(closureKindLabel('PatchPanel')).toBe('Patch panel')
  })

  it('counts tubes from none to four', async () => {
    const { TUBE_COUNTS } = await import('../constants')
    expect(TUBE_COUNTS).toEqual([0, 1, 2, 3, 4])
  })
})
