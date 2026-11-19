import { describe, it, expect } from 'vitest'
import { closureCardPayload, closureCardState } from '../closure-card'

const stored = {
  kind: 'FDC',
  notes: 'by the pole',
  fiberType: 'SUB_SF',
  tubeCount: 0,
  inCoreCount: 24,
  outCoreCount: 12,
  images: ['https://x/a.jpg'],
  cables: [
    { id: 'c1', direction: 'IN', cableType: 'MAIN_SF', coreCount: 24, cableTag: 'IN-1', position: 0 },
    { id: 'c2', direction: 'OUT', cableType: 'SUB_SF', coreCount: 12, cableTag: null, position: 0 },
  ],
}
const noKeys = (state) => ({ ...state, cables: state.cables.map(({ key: _key, ...rest }) => rest) })

describe('closureCardState', () => {
  it('prefills kind, notes, photos and the In / Out cables from the stored closure', () => {
    expect(noKeys(closureCardState(stored))).toEqual({
      kind: 'FDC',
      notes: 'by the pole',
      cables: [
        { direction: 'IN', cableType: 'MAIN_SF', coreCount: '24', cableTag: 'IN-1' },
        { direction: 'OUT', cableType: 'SUB_SF', coreCount: '12', cableTag: '' },
      ],
      images: ['https://x/a.jpg'],
    })
  })

  it('reads a blank closure as not recorded, with the first kind', () => {
    expect(closureCardState(null)).toEqual({
      kind: 'Jumbo',
      notes: '',
      cables: [],
      images: [],
    })
  })

  it('keeps a saved closure with no kind kindless, so an edit never invents one', () => {
    const values = closureCardState({ ...stored, kind: null }, { fresh: false })
    expect(values.kind).toBe('')
    expect(closureCardPayload(values, { mode: 'edit' }).kind).toBeNull()
  })
})

describe('closureCardPayload', () => {
  it('round-trips the stored values on an edit, cables instead of the old sheet', () => {
    const values = closureCardState(stored)
    expect(closureCardPayload(values, { mode: 'edit' })).toEqual({
      kind: 'FDC',
      notes: 'by the pole',
      cables: [
        { direction: 'IN', cableType: 'MAIN_SF', coreCount: 24, cableTag: 'IN-1' },
        { direction: 'OUT', cableType: 'SUB_SF', coreCount: 12, cableTag: null },
      ],
      images: ['https://x/a.jpg'],
    })
  })

  it('an edit that removed every cable sends an empty list', () => {
    const values = { ...closureCardState(stored), cables: [] }
    expect(closureCardPayload(values, { mode: 'edit' }).cables).toEqual([])
  })

  it('leaves out what an edit never read, so nothing is blanked', () => {
    const payload = closureCardPayload(closureCardState({ kind: 'Tiffin', notes: 'x' }), {
      mode: 'edit',
      sheetKnown: false,
      imagesKnown: false,
    })
    expect(payload).toEqual({ kind: 'Tiffin', notes: 'x' })
  })

  it('an edit sends an emptied photo list (that is how photos are removed)', () => {
    const values = { ...closureCardState(stored), images: [] }
    expect(closureCardPayload(values, { mode: 'edit' }).images).toEqual([])
  })

  it('a new closure sends photos only when it has some', () => {
    expect(closureCardPayload(closureCardState(null))).not.toHaveProperty('images')
    expect(closureCardPayload({ ...closureCardState(null), images: ['u'] }).images).toEqual(['u'])
  })
})
