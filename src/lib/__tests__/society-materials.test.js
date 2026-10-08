import { describe, it, expect } from 'vitest'
import {
  MATERIAL_GROUPS,
  MATERIALS,
  MATERIAL_KEYS,
  materialLabel,
  materialUnit,
  unitText,
  materialRows,
} from '@/lib/society-materials'

describe('material catalogue (mirrors backend src/lib/society-materials.js)', () => {
  it('has every key from the brief, in catalogue order', () => {
    expect(MATERIAL_KEYS).toEqual([
      'FIBER_4F', 'FIBER_6F', 'FIBER_12F', 'FIBER_24F', 'FIBER_48F',
      'PVC_PIPE_40', 'PVC_PIPE_25',
      'FLEX_PIPE_40', 'FLEX_PIPE_25',
      'PVC_DUCT_40',
      'FOUR_WAY', 'SIDE_L', 'SCREW_BOX', 'RAWL_PLUG', 'FAT_BOX', 'FDC',
      'CLOSURE_TIFFIN', 'CLOSURE_JUMBO_4WAY',
      'STEEL_TUBE_1X2', 'STEEL_TUBE_1X4', 'STEEL_TUBE_1X6', 'STEEL_TUBE_1X8', 'STEEL_TUBE_1X16',
      'CASSETTE_1X2', 'CASSETTE_1X4', 'CASSETTE_1X6', 'CASSETTE_1X8', 'CASSETTE_1X16',
      'PATCH_LC_LC', 'PATCH_SC_SC', 'PATCH_LC_SC',
    ])
    expect(new Set(MATERIAL_KEYS).size).toBe(MATERIAL_KEYS.length)
  })

  it('groups in the brief order with their units', () => {
    expect(MATERIAL_GROUPS.map((g) => [g.label, g.unit])).toEqual([
      ['Fiber', 'm'],
      ['PVC pipe', 'm'],
      ['Flexible pipe', 'm'],
      ['PVC duct', 'm'],
      ['Fittings', 'count'],
      ['Closures', 'count'],
      ['Steel tube', 'count'],
      ['Cassette', 'count'],
      ['Patch cord', 'count'],
    ])
    for (const g of MATERIAL_GROUPS) for (const item of g.items) expect(item.unit).toBe(g.unit)
    expect(MATERIALS).toHaveLength(MATERIAL_KEYS.length)
  })

  it('uses the brief’s labels', () => {
    expect(materialLabel('FOUR_WAY')).toBe('4-way')
    expect(materialLabel('SIDE_L')).toBe('Side L')
    expect(materialLabel('SCREW_BOX')).toBe('Screw box')
    expect(materialLabel('RAWL_PLUG')).toBe('Rawl plug')
    expect(materialLabel('FAT_BOX')).toBe('FAT box')
    expect(materialLabel('FDC')).toBe('FDC')
    expect(materialLabel('CLOSURE_TIFFIN')).toBe('Tiffin')
    expect(materialLabel('CLOSURE_JUMBO_4WAY')).toBe('Jumbo 4-way')
    expect(materialLabel('PATCH_LC_LC')).toBe('LC–LC')
    expect(materialLabel('PATCH_SC_SC')).toBe('SC–SC')
    expect(materialLabel('PATCH_LC_SC')).toBe('LC–SC')
    expect(materialLabel('FIBER_12F')).toBe('12F')
    expect(materialLabel('PVC_PIPE_40')).toBe('40 mm')
    expect(materialLabel('STEEL_TUBE_1X16')).toBe('1×16')
    expect(materialLabel('NOPE')).toBe('NOPE')
  })

  it('knows each unit and how to print it', () => {
    expect(materialUnit('FIBER_4F')).toBe('m')
    expect(materialUnit('FAT_BOX')).toBe('count')
    expect(unitText('m')).toBe('m')
    expect(unitText('count')).toBe('pcs')
  })

  it('lists only non-zero rows, grouped, in catalogue order', () => {
    const rows = materialRows({ FAT_BOX: 2, FIBER_12F: 150, FIBER_4F: 0, UNKNOWN: 5, PATCH_LC_SC: 4 })
    expect(rows).toEqual([
      { key: 'FIBER', label: 'Fiber', unit: 'm', items: [{ key: 'FIBER_12F', label: '12F', unit: 'm', qty: 150 }] },
      { key: 'FITTINGS', label: 'Fittings', unit: 'count', items: [{ key: 'FAT_BOX', label: 'FAT box', unit: 'count', qty: 2 }] },
      { key: 'PATCH', label: 'Patch cord', unit: 'count', items: [{ key: 'PATCH_LC_SC', label: 'LC–SC', unit: 'count', qty: 4 }] },
    ])
    expect(materialRows(null)).toEqual([])
    expect(materialRows({ FIBER_4F: 0 })).toEqual([])
  })
})
