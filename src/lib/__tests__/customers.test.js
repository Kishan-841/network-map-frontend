// Pin a non-UTC zone: the Date-cell tests read Excel cells back in UTC, so a
// local-time bug shows up here rather than passing by luck on a UTC machine.
process.env.TZ = 'Asia/Kolkata'

import { describe, it, expect } from 'vitest'
import {
  normaliseMobile,
  foldBuildingName,
  parseSheetDate,
  mapCustomerSheet,
  batchByBuilding,
  toImportRow,
  customerBuildingNames,
  customerFormErrors,
  CUSTOMER_TEMPLATE_CSV,
  CUSTOMER_TEMPLATE_HEADERS,
} from '../customers'

const HEADERS = CUSTOMER_TEMPLATE_HEADERS
// A sheet whose columns sit in a different order than the template, plus a
// column we do not store — the reader must still map every field by header.
const SHUFFLED = ['Name', 'Mobile No.', 'PON NUMBER', 'building', 'Plan Amount', 'Plan Validity', 'Auto Renewal', 'Zone', 'Username', 'Address', 'E-Mail ID', 'Site', 'Operator', 'Plan Name', 'Plan Activation Date', 'Plan Expiry Date', 'Status', 'Customer Ageing']
const ROW = ['Ramesh Patil', '919867412726', 'PON-1', 'Silver Oak, Pimple Saudagar', '499', '30', 'NO', 'MORYA INTERNET', '8686692513', 'Flat 101', 'ramesh@example.com', 'PUNE', 'MORYA INTERNET', '100MBPS_UL_3M_OTT', '01-09-2026 10:00:00', '30-09-2026 23:59:59', 'Active', '5']

const building = (o) => ({ id: 'b1', buildingName: 'Silver Oak, Pimple Saudagar', formattedAddress: 'Pimple Saudagar', zone: { name: 'Wakad' }, ...o })

describe('normaliseMobile', () => {
  it('strips the country code and leading zero, keeps digits only', () => {
    expect(normaliseMobile('918686692513')).toBe('8686692513')
    expect(normaliseMobile('08686692513')).toBe('8686692513')
    expect(normaliseMobile('+91 98674 12726')).toBe('9867412726')
    expect(normaliseMobile('')).toBe(null)
    expect(normaliseMobile(null)).toBe(null)
  })
})

describe('parseSheetDate', () => {
  it('reads a typed Excel date cell (UTC-based) as an IST instant', () => {
    const cell = new Date(Date.UTC(2026, 11, 11, 23, 59, 59))
    expect(parseSheetDate(cell).toISOString()).toBe(new Date('2026-12-11T23:59:59+05:30').toISOString())
  })
  it('reads a text date with and without a time, and refuses nonsense', () => {
    expect(parseSheetDate('11-12-2026 23:59:59').toISOString()).toBe(new Date('2026-12-11T23:59:59+05:30').toISOString())
    expect(parseSheetDate('12-09-2026').toISOString()).toBe(new Date('2026-09-12T00:00:00+05:30').toISOString())
    expect(parseSheetDate('n/a')).toBe(null)
    expect(parseSheetDate('')).toBe(null)
  })
})

describe('foldBuildingName', () => {
  it('drops punctuation and case', () => {
    expect(foldBuildingName('Vardhaman Vatika, Phase 1')).toBe(foldBuildingName('vardhaman vatika phase1'))
  })
})

describe('mapCustomerSheet', () => {
  it('maps by header, any order, ignoring extra columns', () => {
    const { ready, needsPick, skipped, error } = mapCustomerSheet(
      [{ name: 'Sheet2', rows: [SHUFFLED, ROW] }],
      { 'Silver Oak, Pimple Saudagar': { matches: [building()] } },
    )
    expect(error).toBe(null)
    expect(needsPick).toEqual([])
    expect(skipped).toEqual([])
    expect(ready).toHaveLength(1)
    expect(ready[0]).toMatchObject({
      row: 2,
      name: 'Ramesh Patil',
      mobile: '9867412726',
      username: '8686692513',
      planAmount: 499,
      planValidityDays: 30,
      autoRenewal: false,
      networkZone: 'MORYA INTERNET',
      status: 'Active',
      ageingDays: 5,
      buildingId: 'b1',
      address: 'Flat 101',
      site: 'PUNE',
    })
    expect(ready[0].planActivatedAt.toISOString()).toBe(new Date('2026-09-01T10:00:00+05:30').toISOString())
  })

  it('reads 0 as an amount (never a blank) and a YES/NO renewal', () => {
    const rows = [['Name', 'Mobile No.', 'building', 'Plan Amount', 'Auto Renewal'], ['A', '9000000001', 'X', 0, 'YES']]
    const { ready } = mapCustomerSheet([{ name: 'S', rows }], { X: { matches: [building({ buildingName: 'X' })] } })
    expect(ready[0]).toMatchObject({ planAmount: 0, autoRenewal: true })
  })

  it('reads a negative cell as blank, numeric or text', () => {
    const rows = [['Name', 'Mobile No.', 'building', 'Plan Amount', 'Ageing'], ['A', '9000000001', 'X', -5, '-3']]
    const { ready } = mapCustomerSheet([{ name: 'S', rows }], { X: { matches: [building({ buildingName: 'X' })] } })
    expect(ready[0].planAmount).toBe(null)
    expect(ready[0].ageingDays).toBe(null)
  })

  it('splits rows into ready / needsPick / skipped with reasons', () => {
    const rows = [
      ['Name', 'Mobile No.', 'building'],
      ['One', '9000000001', 'Silver Oak, Pimple Saudagar'],
      ['Two', '9000000002', 'Anand Park Lane No. 1 Flat Belt'],
      ['Three', '9000000003', 'Nowhere At All'],
      ['Four', '', 'Silver Oak, Pimple Saudagar'],
      ['', '9000000005', 'Silver Oak, Pimple Saudagar'],
    ]
    const { ready, needsPick, skipped } = mapCustomerSheet([{ name: 'S', rows }], {
      'Silver Oak, Pimple Saudagar': { matches: [building()] },
      'Anand Park Lane No. 1 Flat Belt': { matches: [building({ id: 'a1' }), building({ id: 'a2' }), building({ id: 'a3' })] },
      'Nowhere At All': { matches: [] },
    })
    expect(ready.map((r) => r.name)).toEqual(['One'])
    expect(needsPick).toHaveLength(1)
    expect(needsPick[0].candidates.map((c) => c.id)).toEqual(['a1', 'a2', 'a3'])
    expect(needsPick[0].buildingId).toBe(null)
    const reasons = Object.fromEntries(skipped.map((s) => [s.row, s.reason]))
    expect(reasons[4]).toMatch(/no building named/i)
    expect(reasons[5]).toMatch(/mobile/i)
    expect(reasons[6]).toMatch(/name is missing/i)
  })

  it('marks the second copy of a person in one file as a duplicate', () => {
    const rows = [
      ['Name', 'Mobile No.', 'building'],
      ['First', '9000000001', 'X'],
      ['Second', '9000000001', 'X'],
    ]
    const { ready, skipped } = mapCustomerSheet([{ name: 'S', rows }], { X: { matches: [building({ buildingName: 'X' })] } })
    expect(ready).toHaveLength(1)
    expect(skipped).toHaveLength(1)
    expect(skipped[0].reason).toBe('Duplicate in this file')
  })

  it('errors when no sheet carries the customer columns', () => {
    const { error } = mapCustomerSheet([{ name: 'Notes', rows: [['read me']] }])
    expect(error).toMatch(/customer columns/i)
  })

  it('accepts its own CSV template', () => {
    const rows = CUSTOMER_TEMPLATE_CSV.split('\n').filter(Boolean).map((line) => line.split(','))
    const { ready, error } = mapCustomerSheet([{ name: 't', rows }], { 'Silver Oak Pimple Saudagar': { matches: [building({ buildingName: 'Silver Oak Pimple Saudagar' })] } })
    expect(error).toBe(null)
    expect(ready).toHaveLength(1)
    expect(ready[0]).toMatchObject({ name: 'Ramesh Patil', mobile: '9867412726', planAmount: 499, autoRenewal: true })
  })

  it('pins every row to the page’s building when one is forced', () => {
    const rows = [
      ['Name', 'Mobile No.', 'building'],
      ['Mine', '9000000001', 'Silver Oak, Pimple Saudagar'],
      ['Theirs', '9000000002', 'Some Other Tower'],
      ['Blank', '9000000003', ''],
    ]
    const { ready, skipped } = mapCustomerSheet(
      [{ name: 'S', rows }],
      {},
      { id: 'b1', buildingName: 'Silver Oak Pimple Saudagar' },
    )
    expect(ready.map((r) => r.name)).toEqual(['Mine', 'Blank'])
    expect(ready.every((r) => r.buildingId === 'b1')).toBe(true)
    expect(skipped).toHaveLength(1)
    expect(skipped[0].reason).toMatch(/not this building/i)
  })
})

describe('customerBuildingNames', () => {
  it('collects each distinct building name once, across sheets, in order', () => {
    const sheets = [
      { name: 'A', rows: [['Name', 'Mobile No.', 'building'], ['x', '9000000001', 'Silver Oak'], ['y', '9000000002', 'Morya Residency']] },
      { name: 'B', rows: [['Name', 'Mobile No.', 'building'], ['z', '9000000003', 'Silver Oak'], ['w', '9000000004', '']] },
      { name: 'Notes', rows: [['read me']] },
    ]
    expect(customerBuildingNames(sheets)).toEqual(['Silver Oak', 'Morya Residency'])
  })
})

describe('customerFormErrors', () => {
  it('flags a missing name, a bad mobile and a bad email', () => {
    expect(customerFormErrors({ name: '', mobile: '9000000001' })).toContain('Customer name is missing')
    expect(customerFormErrors({ name: 'A', mobile: '123' })).toContain('Mobile number looks wrong')
    expect(customerFormErrors({ name: 'A', mobile: '9000000001', email: 'nope' })).toContain('Email address looks wrong')
    expect(customerFormErrors({ name: 'A', mobile: '+91 98674 12726', email: '' })).toEqual([])
  })
})

describe('template headers', () => {
  it('are the sheet’s 20 columns, with Wing, PON NUMBER and OLT', () => {
    expect(CUSTOMER_TEMPLATE_HEADERS).toHaveLength(20)
    expect(HEADERS).toContain('Mobile No.')
    expect(HEADERS).toEqual(expect.arrayContaining(['Wing', 'PON NUMBER', 'OLT']))
    expect(HEADERS.indexOf('Wing')).toBe(HEADERS.indexOf('building') + 1)
  })
})

describe('Wing, PON NUMBER, OLT and identity', () => {
  const lookup = { X: { matches: [building({ buildingName: 'X' })] } }

  it('reads Wing, PON NUMBER and OLT by header', () => {
    const rows = [['Name', 'Mobile No.', 'building', 'Wing', 'PON NUMBER', 'OLT'], ['A', '9000000001', 'X', ' A ', 6, 'DIAMOND ROCK']]
    const { ready } = mapCustomerSheet([{ name: 'S', rows }], lookup)
    expect(ready[0]).toMatchObject({ wing: 'A', ponNumber: '6', olt: 'DIAMOND ROCK' })
  })

  it('a sheet without the Wing column still maps (wing null)', () => {
    const rows = [['Name', 'Mobile No.', 'building'], ['A', '9000000001', 'X']]
    const { ready } = mapCustomerSheet([{ name: 'S', rows }], lookup)
    expect(ready[0]).toMatchObject({ wing: null, ponNumber: null, olt: null })
  })

  it('same mobile, two usernames → both ready', () => {
    const rows = [['Name', 'Mobile No.', 'building', 'Username'], ['A', '9000000001', 'X', 'u1'], ['A', '9000000001', 'X', 'u2']]
    const { ready, skipped } = mapCustomerSheet([{ name: 'S', rows }], lookup)
    expect(ready).toHaveLength(2)
    expect(skipped).toEqual([])
  })

  it('same username twice → second skipped', () => {
    const rows = [['Name', 'Mobile No.', 'building', 'Username'], ['A', '9000000001', 'X', 'u1'], ['B', '9000000002', 'X', 'u1']]
    const { ready, skipped } = mapCustomerSheet([{ name: 'S', rows }], lookup)
    expect(ready).toHaveLength(1)
    expect(skipped[0].reason).toBe('Duplicate in this file')
  })

  it('toImportRow returns exactly the posted keys', () => {
    const rows = [['Name', 'Mobile No.', 'building', 'Wing'], ['A', '9000000001', 'X', 'B']]
    const { ready } = mapCustomerSheet([{ name: 'S', rows }], lookup)
    const out = toImportRow(ready[0])
    expect(Object.keys(out).sort()).toEqual(['row', 'sheet', 'buildingId', 'wing', 'name', 'mobile', 'username', 'address', 'email', 'site', 'operator', 'networkZone', 'planName', 'planAmount', 'planValidityDays', 'autoRenewal', 'planActivatedAt', 'planExpiresAt', 'status', 'ageingDays', 'ponNumber', 'olt'].sort())
    expect(out.wing).toBe('B')
  })
})

describe('batchByBuilding', () => {
  const make = (id, n) => Array.from({ length: n }, (_, i) => ({ buildingId: id, i }))
  it('never splits a building', () => {
    const batches = batchByBuilding([...make('a', 600), ...make('b', 500), ...make('c', 300)], 1000)
    expect(batches.every((b) => b.length <= 1000)).toBe(true)
    const where = {}
    batches.forEach((b, i) => b.forEach((r) => { where[r.buildingId] ??= new Set(); where[r.buildingId].add(i) }))
    expect(Object.values(where).every((s) => s.size === 1)).toBe(true)
    expect(batches.flat()).toHaveLength(1400)
    expect(batches).toHaveLength(2)
  })
  it('splits an oversized building on its own', () => {
    expect(batchByBuilding(make('a', 2300), 1000).map((b) => b.length)).toEqual([1000, 1000, 300])
  })
})
