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
}

describe('closureCardState', () => {
  it('prefills every field from the stored closure, 0 tubes included', () => {
    expect(closureCardState(stored)).toEqual({
      kind: 'FDC',
      notes: 'by the pole',
      sheet: { fiberType: 'SUB_SF', tubeCount: '0', inCoreCount: '24', outCoreCount: '12' },
      images: ['https://x/a.jpg'],
    })
  })

  it('reads a blank closure as not recorded, with the first kind', () => {
    expect(closureCardState(null)).toEqual({
      kind: 'Jumbo',
      notes: '',
      sheet: { fiberType: '', tubeCount: '', inCoreCount: '', outCoreCount: '' },
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
  it('round-trips the stored values on an edit', () => {
    const values = closureCardState(stored)
    expect(closureCardPayload(values, { mode: 'edit' })).toEqual({
      kind: 'FDC',
      notes: 'by the pole',
      fiberType: 'SUB_SF',
      tubeCount: 0,
      inCoreCount: 24,
      outCoreCount: 12,
      images: ['https://x/a.jpg'],
    })
  })

  it('sends a changed core count and clears with null', () => {
    const values = closureCardState(stored)
    values.sheet.outCoreCount = '48'
    values.sheet.fiberType = ''
    expect(closureCardPayload(values, { mode: 'edit' })).toMatchObject({ outCoreCount: 48, fiberType: null })
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
