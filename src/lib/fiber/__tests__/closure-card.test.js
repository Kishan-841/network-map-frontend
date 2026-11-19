import { describe, it, expect } from 'vitest'
import { CLOSURE_SHEET_ANCHORED, closureCardPayload, closureCardPlacement, closureCardState } from '../closure-card'

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

describe('closureCardPlacement', () => {
  const bounds = { width: 1100, height: 800 }

  it('keeps the card where it was tapped and lets it use the room below', () => {
    expect(closureCardPlacement({ at: { x: 200, y: 100 }, bounds })).toEqual({ left: 200, top: 100, maxHeight: 692 })
  })

  it('lifts a card tapped low on the map, and caps it to the map so Save stays on screen', () => {
    const { top, maxHeight } = closureCardPlacement({ at: { x: 200, y: 700 }, bounds })
    expect(top).toBe(212)
    expect(top + maxHeight).toBe(bounds.height - 8)
  })

  it('keeps the card off the right edge', () => {
    expect(closureCardPlacement({ at: { x: 1090, y: 50 }, bounds }).left).toBe(1100 - 332)
  })

  it('without bounds, uses the tap and sets no cap', () => {
    expect(closureCardPlacement({ at: { x: 5, y: 6 }, bounds: null })).toEqual({ left: 5, top: 6, maxHeight: null })
  })
})

describe('the edit card on desktop', () => {
  it('is capped to the map and scrolls, so its top never leaves the screen', () => {
    expect(CLOSURE_SHEET_ANCHORED).not.toContain('max-h-none')
    expect(CLOSURE_SHEET_ANCHORED).toContain('lg:max-h-[calc(100%-8rem)]')
  })
})
