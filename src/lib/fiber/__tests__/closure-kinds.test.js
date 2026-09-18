import { describe, it, expect } from 'vitest'
import { CLOSURE_KINDS, closureKindLabel } from '../constants'

describe('closure kinds', () => {
  it('offers Jumbo, Tiffin and Compass, storing the plain name', () => {
    expect(CLOSURE_KINDS.map((k) => k.value)).toEqual(['Jumbo', 'Tiffin', 'Compass'])
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
