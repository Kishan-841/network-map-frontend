// Pin a non-UTC zone so the UTC-getter tests discriminate: with local getters,
// IST turns a 09:30 time cell into 14:51 (1899 LMT offset). Node honours TZ
// changes at runtime; Dates are only built inside the tests.
process.env.TZ = 'Asia/Kolkata'

import { describe, it, expect } from 'vitest'
import { cellToDate, cellToTime, readPlanSheet, PLAN_TEMPLATE_CSV, fmtDay } from '../visit-plan-sheet'

const HEAD = ['Employee', 'Building', 'Date', 'Start time', 'End time', 'Repeat until', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

describe('visit plan sheet', () => {
  it('converts Excel date/time cells (UTC-based Dates) to plain strings', () => {
    expect(cellToDate(new Date(Date.UTC(2026, 10, 2)))).toBe('2026-11-02')
    expect(cellToTime(new Date(Date.UTC(1899, 11, 30, 9, 30)))).toBe('09:30')
    expect(cellToDate(' 02-11-2026 ')).toBe('02-11-2026')
    expect(cellToTime(null)).toBe('')
  })
  it('keeps the calendar day west of UTC too (local getters would give the day before)', () => {
    const before = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      expect(cellToDate(new Date(Date.UTC(2026, 10, 2)))).toBe('2026-11-02')
      expect(fmtDay('2026-11-02')).toBe('2 Nov')
    } finally {
      process.env.TZ = before
    }
  })
  it('finds the header row on any sheet, maps by name, ignores extra columns', () => {
    const sheets = [
      { name: 'Notes', rows: [['read me']] },
      { name: 'Tasks', rows: [['#### NOTES'], ['Leaflets', ...HEAD.slice().reverse()], ['x', 'Y', '', '', '', '', '', 'Y', '30-11-2026', '11:00', '09:30', '02-11-2026', 'Silver Oak', 'Prashant']] },
    ]
    const { rows, error } = readPlanSheet(sheets)
    expect(error).toBeNull()
    expect(rows).toEqual([{
      rowNumber: 3, employee: 'Prashant', building: 'Silver Oak', date: '02-11-2026', startTime: '09:30', endTime: '11:00',
      until: '30-11-2026', weekdays: [true, false, false, false, false, false, true],
    }])
  })
  it('reads real Date cells from an .xlsx row', () => {
    const { rows } = readPlanSheet([{ name: 'S', rows: [HEAD, ['A', 'B', new Date(Date.UTC(2026, 10, 2)), new Date(Date.UTC(1899, 11, 30, 18, 5)), null, null, null, null, null, null, null, null, null]] }])
    expect(rows[0]).toMatchObject({ date: '2026-11-02', startTime: '18:05', endTime: '', until: '', weekdays: [false, false, false, false, false, false, false] })
  })
  it('skips blank rows and reports a missing header', () => {
    expect(readPlanSheet([{ name: 'S', rows: [HEAD, ['', '', '']] }]).rows).toEqual([])
    expect(readPlanSheet([{ name: 'S', rows: [['Name', 'Place']] }]).error).toMatch(/Employee/)
  })
  it('ships a template whose header the reader accepts', () => {
    const rows = PLAN_TEMPLATE_CSV.split('\n').map((l) => l.split(','))
    const read = readPlanSheet([{ name: 't', rows }])
    expect(read.error).toBeNull()
    expect(read.rows).toHaveLength(2)
    expect(read.rows[0].weekdays).toEqual([true, false, false, true, false, false, false])
  })
  it('formats a plan day without a time-zone shift', () => {
    expect(fmtDay('2026-11-02')).toBe('2 Nov')
    expect(fmtDay('2026-11-30T00:00:00.000Z')).toBe('30 Nov')
    expect(fmtDay(null)).toBe('')
  })
})

import {
  WEEKLY_TEMPLATE_CSV,
  MONTHLY_TEMPLATE_CSV,
  parseSheetDate,
  weeklyDates,
  visitsText,
  REPEAT_ERROR,
  seriesChoices,
  seriesResultText,
  handoverText,
} from '../visit-plan-sheet'

const WHEAD = ['Employee', 'Building', 'Date', 'Start time', 'End time', 'Repeat (weeks)']

describe('weekly plan sheet', () => {
  it.each(['Repeat', 'Repeat weeks', 'Repeat (weeks)', 'Weeks', ' repeat (Weeks) ', 'REPEAT WEEKS'])(
    'detects a weekly sheet by the "%s" column',
    (name) => {
      const read = readPlanSheet([{ name: 'S', rows: [[...WHEAD.slice(0, 5), name], ['A', 'B', '13-10-2026', '09:00', '10:00', '4']] }])
      expect(read.error).toBeNull()
      expect(read.kind).toBe('weekly')
      expect(read.rows[0]).toEqual({
        rowNumber: 2, employee: 'A', building: 'B', date: '13-10-2026', startTime: '09:00', endTime: '10:00', repeatWeeks: '4', repeat: 4, repeatError: null,
      })
    },
  )
  it('calls a sheet with Repeat until / weekday columns monthly (as before)', () => {
    expect(readPlanSheet([{ name: 'S', rows: [HEAD, ['A', 'B', '02-11-2026']] }]).kind).toBe('monthly')
    // No repeat columns at all — one-off rows, read the old way.
    expect(readPlanSheet([{ name: 'S', rows: [HEAD.slice(0, 5), ['A', 'B', '02-11-2026']] }]).kind).toBe('monthly')
  })
  it('refuses a sheet with both kinds of columns', () => {
    const both = readPlanSheet([{ name: 'S', rows: [[...WHEAD, 'Mon'], ['A', 'B', '13-10-2026', '', '', '2', 'Y']] }])
    expect(both.rows).toEqual([])
    expect(both.error).toMatch(/Use one template — weekly or monthly/)
    const both2 = readPlanSheet([{ name: 'S', rows: [[...WHEAD, 'Repeat until'], ['A', 'B']] }])
    expect(both2.error).toMatch(/Use one template — weekly or monthly/)
  })
  it('reads blank repeat as 1, numbers from .xlsx cells, and flags bad repeats on the row', () => {
    const rows = [WHEAD, ...[['A', 'B', '13-10-2026', '', '', ''], ['A', 'B', '13-10-2026', '', '', 3], ['A', 'B', '13-10-2026', '', '', ' 13 '], ['A', 'B', '13-10-2026', '', '', '4.0'],
      ['A', 'B', '13-10-2026', '', '', '0'], ['A', 'B', '13-10-2026', '', '', '14'], ['A', 'B', '13-10-2026', '', '', '2.5'],
      ['A', 'B', '13-10-2026', '', '', 'two'], ['A', 'B', '13-10-2026', '', '', -1], ['A', 'B', '13-10-2026', '', '', 2.5]]]
    const read = readPlanSheet([{ name: 'S', rows }]).rows
    expect(read.map((r) => r.repeat)).toEqual([1, 3, 13, 4, null, null, null, null, null, null])
    expect(read.map((r) => r.repeatError)).toEqual([null, null, null, null, ...Array(6).fill(REPEAT_ERROR)])
    // The raw cell travels to the server, which re-checks it.
    expect(read.map((r) => r.repeatWeeks).slice(0, 4)).toEqual(['', 3, '13', '4.0'])
    expect(read[5].repeatWeeks).toBe('14')
    expect(REPEAT_ERROR).toBe('Repeat must be a whole number of weeks, 1–13')
  })
  it('reads real Date cells on a weekly row', () => {
    const { rows } = readPlanSheet([{ name: 'S', rows: [WHEAD, ['A', 'B', new Date(Date.UTC(2026, 9, 13)), new Date(Date.UTC(1899, 11, 30, 9, 30)), null, null]] }])
    expect(rows[0]).toMatchObject({ date: '2026-10-13', startTime: '09:30', endTime: '', repeat: 1 })
  })
})

describe('weekly occurrences', () => {
  it('parses the sheet date formats the server accepts', () => {
    expect(parseSheetDate('13-10-2026')).toBe('2026-10-13')
    expect(parseSheetDate('3/11/2026')).toBe('2026-11-03')
    expect(parseSheetDate('2026-10-13')).toBe('2026-10-13')
    expect(parseSheetDate('31-02-2026')).toBeNull()
    expect(parseSheetDate('')).toBeNull()
  })
  it('gives N dates on the same weekday, first → last', () => {
    expect(weeklyDates('13-10-2026', 4)).toEqual(['2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03'])
    expect(weeklyDates('2026-12-29', 2)).toEqual(['2026-12-29', '2027-01-05'])
    expect(weeklyDates('13-10-2026', 1)).toEqual(['2026-10-13'])
    expect(weeklyDates('bad', 3)).toEqual([])
    expect(weeklyDates('13-10-2026', null)).toEqual([])
    const days = weeklyDates('13-10-2026', 13).map((d) => new Date(`${d}T00:00:00Z`).getUTCDay())
    expect(new Set(days)).toEqual(new Set([2]))
  })
  it('describes the visits a row makes', () => {
    expect(visitsText(['2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03'])).toBe('4 visits · 13 Oct → 3 Nov')
    expect(visitsText(['2026-10-13'])).toBe('1 visit · 13 Oct')
    expect(visitsText([])).toBe('No visits left')
  })
})

describe('plan templates', () => {
  it('keeps the monthly template byte-identical', () => {
    expect(MONTHLY_TEMPLATE_CSV).toBe(
      'Employee,Building,Date,Start time,End time,Repeat until,Mon,Tue,Wed,Thu,Fri,Sat,Sun\n' +
        'Prashant Kambale,Silver Oak Pimple Saudagar,02-11-2026,09:30,11:00,30-11-2026,Y,,,Y,,,\n' +
        'Prashant Kambale,Sunit Apartment,03-11-2026,11:30,13:00,,,,,,,,',
    )
    expect(PLAN_TEMPLATE_CSV).toBe(MONTHLY_TEMPLATE_CSV)
  })
  it('ships a weekly template the reader reads as weekly', () => {
    const read = readPlanSheet([{ name: 't', rows: WEEKLY_TEMPLATE_CSV.split('\n').map((l) => l.split(',')) }])
    expect(read.error).toBeNull()
    expect(read.kind).toBe('weekly')
    expect(read.rows.length).toBeGreaterThanOrEqual(2)
    expect(read.rows.every((r) => r.repeatError === null)).toBe(true)
    expect(WEEKLY_TEMPLATE_CSV.split('\n')[0]).toBe('Employee,Building,Date,Start time,End time,Repeat (weeks)')
  })
})

describe('series choice', () => {
  it('labels the two choices with the count of later repeats', () => {
    expect(seriesChoices(3)).toEqual([
      { value: 'ONE', label: 'This visit only' },
      { value: 'FOLLOWING', label: 'This and the 3 later repeats' },
    ])
    expect(seriesChoices(1)[1].label).toBe('This and the 1 later repeat')
    expect(seriesChoices(0)).toEqual([])
    expect(seriesChoices(undefined)).toEqual([])
  })
  it('says what a series change did', () => {
    expect(seriesResultText('Changed', { changed: 4, skipped: 0 })).toBe('Changed 4 visits')
    expect(seriesResultText('Changed', { changed: 3, skipped: 1 })).toBe('Changed 3 visits · skipped 1 already visited')
    expect(seriesResultText('Deleted', { changed: 1, skipped: 2 })).toBe('Deleted 1 visit · skipped 2 already visited')
  })
  it('adds hand-over and out-of-team counts when there are any', () => {
    expect(seriesResultText('Changed', { changed: 3, skipped: 1, released: 2, outOfScope: 1 })).toBe(
      "Changed 3 visits · skipped 1 already visited · 2 of the previous holder's visits for this building removed · 1 repeat outside your team left as is",
    )
    expect(seriesResultText('Deleted', { changed: 2, outOfScope: 3 })).toBe('Deleted 2 visits · 3 repeats outside your team left as is')
    expect(seriesResultText('Changed', { changed: 1, released: 1 })).toBe(
      "Changed 1 visit · 1 of the previous holder's visits for this building removed",
    )
    expect(handoverText(0)).toBe('')
    expect(handoverText(1)).toBe(" · 1 of the previous holder's visits for this building removed")
  })
})
