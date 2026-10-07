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
