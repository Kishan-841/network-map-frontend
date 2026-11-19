import { describe, it, expect } from 'vitest'
import { cableSummary, cablesBySide, cablesPayload, cablesToForm, emptyCable } from '../closure-cables'
import { CLOSURE_CABLE_CORES } from '../constants'

const noKey = (rows) => rows.map(({ key: _key, ...rest }) => rest)

describe('closure cable helpers', () => {
  it('offers the closure core counts, 8 included', () => {
    expect(CLOSURE_CABLE_CORES).toEqual([2, 4, 6, 8, 12, 24, 48])
  })

  it('starts a blank row on the asked side, with its own key', () => {
    const a = emptyCable('IN')
    const b = emptyCable('OUT')
    expect(noKey([a, b])).toEqual([
      { direction: 'IN', cableType: '', coreCount: '', cableTag: '' },
      { direction: 'OUT', cableType: '', coreCount: '', cableTag: '' },
    ])
    expect(a.key).toBeTruthy()
    expect(a.key).not.toBe(b.key)
  })

  it('reads stored cables as form strings, nulls as blank', () => {
    const rows = cablesToForm([
      { id: 'x', direction: 'IN', cableType: 'MAIN_SF', coreCount: 12, cableTag: 'A1', position: 0 },
      { id: 'y', direction: 'OUT', cableType: null, coreCount: null, cableTag: null, position: 0 },
    ])
    expect(noKey(rows)).toEqual([
      { direction: 'IN', cableType: 'MAIN_SF', coreCount: '12', cableTag: 'A1' },
      { direction: 'OUT', cableType: '', coreCount: '', cableTag: '' },
    ])
    expect(cablesToForm(undefined)).toEqual([])
  })

  it('sends numbers and trimmed tags, and drops rows left completely blank', () => {
    const rows = [
      { key: '1', direction: 'IN', cableType: 'SUB_SF', coreCount: '8', cableTag: '  FIB-22 ' },
      { key: '2', direction: 'OUT', cableType: '', coreCount: '', cableTag: '   ' },
      { key: '3', direction: 'OUT', cableType: '', coreCount: '', cableTag: 'T9' },
    ]
    expect(cablesPayload(rows)).toEqual([
      { direction: 'IN', cableType: 'SUB_SF', coreCount: 8, cableTag: 'FIB-22' },
      { direction: 'OUT', cableType: null, coreCount: null, cableTag: 'T9' },
    ])
  })

  it('splits stored cables into In and Out', () => {
    const cables = [
      { direction: 'OUT', coreCount: 2 },
      { direction: 'IN', coreCount: 12 },
      { direction: 'OUT', coreCount: 6 },
    ]
    expect(cablesBySide(cables)).toEqual({
      IN: [{ direction: 'IN', coreCount: 12 }],
      OUT: [
        { direction: 'OUT', coreCount: 2 },
        { direction: 'OUT', coreCount: 6 },
      ],
    })
    expect(cablesBySide(undefined)).toEqual({ IN: [], OUT: [] })
  })

  it('summarises a cable in one line, skipping what was not recorded', () => {
    expect(cableSummary({ cableType: 'MAIN_SF', coreCount: 12, cableTag: 'FIB-22' })).toBe('Main SF · 12 core · FIB-22')
    expect(cableSummary({ cableType: null, coreCount: 8, cableTag: null })).toBe('8 core')
    expect(cableSummary({ cableType: null, coreCount: null, cableTag: null })).toBe('Not recorded')
  })
})
