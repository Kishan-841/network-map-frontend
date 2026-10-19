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
  pickByZone,
  effectivePick,
  importRowKey,
  ambiguousNameGroups,
  unreviewedZoneMatches,
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

  it('merges the second copy of a person (same building + mobile) into the first', () => {
    const rows = [
      ['Name', 'Mobile No.', 'building'],
      ['First', '9000000001', 'X'],
      ['Second', '9000000001', 'X'],
    ]
    const { ready, skipped } = mapCustomerSheet([{ name: 'S', rows }], { X: { matches: [building({ buildingName: 'X' })] } })
    expect(ready).toHaveLength(1)
    expect(skipped).toEqual([])
    expect(ready[0]).toMatchObject({ name: 'First', row: 2, mergedFrom: [{ sheet: 'S', row: 3 }] })
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

  it('same username twice → one entry, the first row’s values kept', () => {
    const rows = [['Name', 'Mobile No.', 'building', 'Username'], ['A', '9000000001', 'X', 'u1'], ['B', '9000000002', 'X', 'u1']]
    const { ready, skipped } = mapCustomerSheet([{ name: 'S', rows }], lookup)
    expect(ready).toHaveLength(1)
    expect(skipped).toEqual([])
    expect(ready[0]).toMatchObject({ name: 'A', mobile: '9000000001', mergedFrom: [{ sheet: 'S', row: 3 }] })
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

// The owner's workbook: every ambiguous row says Zone "MORYA INTERNET"; the
// registry's candidates sit in "MORYA INTERNET FTTH" or another ISP's zone.
const cand = (id, zoneName, name = 'Morya Residency') => ({ id, buildingName: name, address: `${id} street`, zoneName })

describe('pickByZone', () => {
  it('picks the one candidate whose zone starts with the sheet zone', () => {
    const a = cand('m1', 'MORYA INTERNET FTTH')
    const b = cand('m2', 'SHRINATH HINJAWADI')
    expect(pickByZone([b, a], 'MORYA INTERNET')).toEqual({ pick: a, narrowed: [a] })
  })

  it('never guesses between several in the same zone', () => {
    const all = [cand('a1', 'MORYA INTERNET FTTH'), cand('a2', 'MORYA INTERNET FTTH'), cand('a3', 'MORYA INTERNET FTTH')]
    expect(pickByZone(all, 'MORYA INTERNET')).toEqual({ pick: null, narrowed: all })
  })

  it('an exact zone name beats a startsWith match, ignoring case and punctuation', () => {
    const exact = cand('e', 'Morya-Internet')
    const longer = cand('l', 'MORYA INTERNET FTTH')
    expect(pickByZone([longer, exact], 'MORYA INTERNET').pick).toBe(exact)
  })

  it('narrows to the best tier when it holds several', () => {
    const x = cand('x', 'MORYA INTERNET FTTH')
    const y = cand('y', 'MORYA INTERNET FIBRE')
    const z = cand('z', 'VIKRAM BROADBAND')
    expect(pickByZone([z, x, y], 'MORYA INTERNET')).toEqual({ pick: null, narrowed: [x, y] })
  })

  it('a blank zone, or one nobody matches, keeps every candidate', () => {
    const all = [cand('a', 'VAISHNAVI INFOTECH'), cand('b', 'VIKRAM BROADBAND')]
    expect(pickByZone(all, '')).toEqual({ pick: null, narrowed: all })
    expect(pickByZone(all, null)).toEqual({ pick: null, narrowed: all })
    expect(pickByZone(all, 'MORYA INTERNET')).toEqual({ pick: null, narrowed: all })
  })
})

describe('mapCustomerSheet — zone-aware pick', () => {
  const b = (id, zone, name) => building({ id, buildingName: name, formattedAddress: `${id} street`, zone: zone ? { name: zone } : null })
  const lookup = {
    'Morya Residency': { matches: [b('m2', 'SHRINATH HINJAWADI', 'Morya Residency'), b('m1', 'MORYA INTERNET FTTH', 'Morya Residency')] },
    'Anand Park Lane No. 1 Flat Belt': {
      matches: ['a1', 'a2', 'a3'].map((id) => b(id, 'MORYA INTERNET FTTH', 'Anand Park Lane No. 1 Flat Belt')),
    },
    'Two Zones': { matches: [b('t1', 'VAISHNAVI INFOTECH', 'Two Zones'), b('t2', 'MORYA INTERNET FTTH', 'Two Zones'), b('t3', 'MORYA INTERNET', 'Two Zones')] },
    Elsewhere: { matches: [b('e1', 'VIKRAM BROADBAND', 'Elsewhere'), b('e2', 'VAISHNAVI INFOTECH', 'Elsewhere')] },
  }
  const sheet = (rows) => [{ name: 'S', rows: [['Name', 'Mobile No.', 'building', 'Zone'], ...rows] }]

  it('auto-picks Morya Residency by zone, keeping every candidate to change it', () => {
    const { ready, needsPick } = mapCustomerSheet(sheet([['A', '9000000001', 'Morya Residency', 'MORYA INTERNET']]), lookup)
    expect(needsPick).toEqual([])
    expect(ready).toHaveLength(1)
    expect(ready[0]).toMatchObject({ buildingId: 'm1', buildingName: 'Morya Residency', autoPicked: true, sheetBuildingName: 'Morya Residency' })
    expect(ready[0].candidates.map((c) => c.id).sort()).toEqual(['m1', 'm2'])
  })

  it('Anand Park three-way in one zone still needs a pick, all three offered', () => {
    const { ready, needsPick } = mapCustomerSheet(sheet([['A', '9000000001', 'Anand Park Lane No. 1 Flat Belt', 'MORYA INTERNET']]), lookup)
    expect(ready).toEqual([])
    expect(needsPick[0].candidates.map((c) => c.id)).toEqual(['a1', 'a2', 'a3'])
    expect(needsPick[0].buildingId).toBe(null)
  })

  it('the exact zone name wins over the startsWith one', () => {
    const { ready } = mapCustomerSheet(sheet([['A', '9000000001', 'Two Zones', 'MORYA INTERNET']]), lookup)
    expect(ready[0]).toMatchObject({ buildingId: 't3', autoPicked: true })
  })

  it('a blank zone leaves the row to pick, candidates unchanged', () => {
    const { needsPick } = mapCustomerSheet(sheet([['A', '9000000001', 'Morya Residency', '']]), lookup)
    expect(needsPick[0].candidates.map((c) => c.id)).toEqual(['m2', 'm1'])
  })

  it('a zone no candidate is in leaves every candidate', () => {
    const { needsPick } = mapCustomerSheet(sheet([['A', '9000000001', 'Elsewhere', 'MORYA INTERNET']]), lookup)
    expect(needsPick[0].candidates.map((c) => c.id)).toEqual(['e1', 'e2'])
  })

  it('a narrowed list comes first, the rest stay choosable after it', () => {
    const lk = { N: { matches: [b('n1', 'VIKRAM BROADBAND', 'N'), b('n2', 'MORYA INTERNET FTTH', 'N'), b('n3', 'MORYA INTERNET FIBRE', 'N')] } }
    const { needsPick } = mapCustomerSheet(sheet([['A', '9000000001', 'N', 'MORYA INTERNET']]), lk)
    expect(needsPick[0].candidates.map((c) => c.id)).toEqual(['n2', 'n3', 'n1'])
  })
})

describe('mapCustomerSheet — merging duplicate rows', () => {
  const lookup = { X: { matches: [building({ id: 'bx', buildingName: 'X' })] } }

  it('fills PON / OLT from a later sheet for the same Username, keeping the first name', () => {
    const sheets = [
      { name: 'Sheet2', rows: [['Username', 'Name', 'Mobile No.', 'building'], ['u1', 'Ramesh Patil', '9000000001', 'X']] },
      {
        name: 'test',
        rows: [
          ['Username', 'Name', 'Mobile No.', 'building', 'PON NUMBER', 'OLT'],
          ['u1', 'RAMESH P', '9000000001', 'X', 6, 'DIAMOND ROCK'],
        ],
      },
    ]
    const { ready, skipped } = mapCustomerSheet(sheets, lookup)
    expect(skipped).toEqual([])
    expect(ready).toHaveLength(1)
    expect(ready[0]).toMatchObject({
      sheet: 'Sheet2',
      row: 2,
      name: 'Ramesh Patil',
      ponNumber: '6',
      olt: 'DIAMOND ROCK',
      mergedFrom: [{ sheet: 'test', row: 2 }],
    })
  })

  it('on a conflict the earlier non-blank value wins; 0 is not blank', () => {
    const rows = [
      ['Username', 'Name', 'Mobile No.', 'building', 'PON NUMBER', 'Plan Amount', 'E-Mail ID'],
      ['u1', 'A', '9000000001', 'X', '5', 0, ''],
      ['u1', 'A', '9000000001', 'X', '9', 499, 'a@b.co'],
    ]
    const { ready } = mapCustomerSheet([{ name: 'S', rows }], lookup)
    expect(ready).toHaveLength(1)
    expect(ready[0]).toMatchObject({ ponNumber: '5', planAmount: 0, email: 'a@b.co' })
  })

  it('two Usernames on one mobile stay two entries', () => {
    const rows = [['Username', 'Name', 'Mobile No.', 'building'], ['u1', 'A', '9000000001', 'X'], ['u2', 'A', '9000000001', 'X']]
    const { ready } = mapCustomerSheet([{ name: 'S', rows }], lookup)
    expect(ready).toHaveLength(2)
    expect(ready.every((r) => !r.mergedFrom)).toBe(true)
  })

  it('a merged-in Zone lets an ambiguous row be picked by zone', () => {
    const lk = {
      M: { matches: [building({ id: 'm1', buildingName: 'M', zone: { name: 'MORYA INTERNET FTTH' } }), building({ id: 'm2', buildingName: 'M', zone: { name: 'VIKRAM BROADBAND' } })] },
    }
    const rows = [['Username', 'Name', 'Mobile No.', 'building', 'Zone'], ['u1', 'A', '9000000001', 'M', ''], ['u1', 'A', '9000000001', 'M', 'MORYA INTERNET']]
    const { ready, needsPick } = mapCustomerSheet([{ name: 'S', rows }], lk)
    expect(needsPick).toEqual([])
    expect(ready[0]).toMatchObject({ buildingId: 'm1', autoPicked: true, networkZone: 'MORYA INTERNET', mergedFrom: [{ sheet: 'S', row: 3 }] })
  })

  it('rows of an unresolved building merge by sheet name + mobile', () => {
    const both = { matches: [building({ id: 'm1', buildingName: 'M' }), building({ id: 'm2', buildingName: 'M' })] }
    const lk = { M: both, m: both }
    const rows = [['Name', 'Mobile No.', 'building', 'OLT'], ['A', '9000000001', 'M', ''], ['A', '9000000001', 'm', 'ROCK']]
    const { needsPick } = mapCustomerSheet([{ name: 'S', rows }], lk)
    expect(needsPick).toHaveLength(1)
    expect(needsPick[0]).toMatchObject({ olt: 'ROCK', mergedFrom: [{ sheet: 'S', row: 3 }] })
  })
})

describe('effectivePick and name groups', () => {
  const c1 = cand('a1', 'MORYA INTERNET FTTH', 'Anand Park')
  const c2 = cand('a2', 'MORYA INTERNET FTTH', 'Anand Park')
  const pending = { sheet: 'S', row: 2, buildingId: null, buildingName: 'Anand Park', sheetBuildingName: 'Anand Park', candidates: [c1, c2] }
  const pending2 = { ...pending, row: 3 }
  const auto = { sheet: 'S', row: 4, buildingId: 'm1', buildingName: 'Morya', sheetBuildingName: 'Morya', autoPicked: true, candidates: [cand('m1', 'MORYA INTERNET FTTH', 'Morya'), cand('m2', 'X', 'Morya')] }
  const plain = { sheet: 'S', row: 5, buildingId: 'b1', buildingName: 'Silver Oak' }

  it('keys a row by sheet and row', () => {
    expect(importRowKey(pending)).toBe('S:2')
  })

  it('a row pick beats a name pick; a name pick fills the rest', () => {
    expect(effectivePick(pending, { 'S:2': c2 }, { 'Anand Park': c1 })).toBe(c2)
    expect(effectivePick(pending2, { 'S:2': c2 }, { 'Anand Park': c1 })).toBe(c1)
    expect(effectivePick(pending2, {}, {})).toBe(null)
  })

  it('ignores a name pick that is not one of the row’s candidates', () => {
    expect(effectivePick(pending, {}, { 'Anand Park': cand('zz', 'Q') })).toBe(null)
  })

  it('an auto-picked row keeps its zone pick unless the row itself is changed', () => {
    expect(effectivePick(auto, {}, { Morya: auto.candidates[1] })).toEqual({ id: 'm1', buildingName: 'Morya' })
    expect(effectivePick(auto, { 'S:4': auto.candidates[1] }, {})).toBe(auto.candidates[1])
  })

  it('a resolved row is its own building', () => {
    expect(effectivePick(plain, {}, {})).toEqual({ id: 'b1', buildingName: 'Silver Oak' })
  })

  it('groups rows still to pick by their sheet building name', () => {
    const other = { ...pending, row: 9, sheetBuildingName: 'Other', buildingName: 'Other', candidates: [c2] }
    expect(ambiguousNameGroups([pending, pending2, other])).toEqual([
      { name: 'Anand Park', count: 2, total: 2, candidates: [c1, c2] },
      { name: 'Other', count: 1, total: 1, candidates: [c2] },
    ])
  })

  it('counts only the rows a name pick would apply to', () => {
    expect(ambiguousNameGroups([pending, pending2], { 'S:2': c1 })[0]).toMatchObject({ count: 1, total: 2 })
    expect(ambiguousNameGroups([pending, pending2], { 'S:2': c1, 'S:3': c2 })[0]).toMatchObject({ count: 0, total: 2 })
  })

  it('counts zone matches nobody has changed', () => {
    const auto2 = { ...auto, row: 6 }
    expect(unreviewedZoneMatches([auto, auto2, plain], {})).toBe(2)
    expect(unreviewedZoneMatches([auto, auto2, plain], { 'S:6': auto.candidates[1] })).toBe(1)
  })
})
