process.env.TZ = 'Asia/Kolkata'

import { describe, it, expect } from 'vitest'
import writeXlsxFile from 'write-excel-file/node'
import readXlsxFile from 'read-excel-file/node'
import { nextWeekday, planTemplateSheet, PLAN_XLSX_TEMPLATES } from '../visit-plan-template'
import { readPlanSheet } from '../visit-plan-sheet'

// Thursday 9 Oct 2026.
const TODAY = '2026-10-09'

async function roundTrip(kind) {
  const { data, options } = planTemplateSheet(kind, TODAY)
  const buffer = await writeXlsxFile(data, options).toBuffer()
  const sheets = await readXlsxFile(buffer)
  return readPlanSheet(sheets.map((s) => ({ name: s.sheet, rows: s.data })))
}

describe('xlsx plan templates', () => {
  it('finds the next weekday strictly after today', () => {
    expect(nextWeekday(TODAY, 0)).toBe('2026-10-12') // Mon
    expect(nextWeekday(TODAY, 1)).toBe('2026-10-13') // Tue
    expect(nextWeekday(TODAY, 3)).toBe('2026-10-15') // Thu → a week on, not today
  })
  it('weekly: header bold, dates and times formatted', () => {
    const { data, options } = planTemplateSheet('weekly', TODAY)
    expect(data[0].map((c) => c.value)).toEqual(['Employee', 'Building', 'Date', 'Start time', 'End time', 'Repeat (weeks)'])
    expect(data[0].every((c) => c.fontWeight === 'bold')).toBe(true)
    expect(data[1][2]).toMatchObject({ type: Date, format: 'dd-mmm-yyyy' })
    expect(data[1][3]).toMatchObject({ format: 'hh:mm' })
    expect(options.columns).toHaveLength(6)
    expect(options.sheet).toBe('Visit plan')
  })
  it('weekly template reads back through the upload reader', async () => {
    const read = await roundTrip('weekly')
    expect(read.error).toBeNull()
    expect(read.kind).toBe('weekly')
    expect(read.rows[0]).toMatchObject({ date: '2026-10-12', startTime: '09:30', endTime: '11:00', repeat: 4, repeatError: null })
    expect(read.rows[1]).toMatchObject({ date: '2026-10-13', startTime: '11:30', endTime: '13:00', repeat: 1 })
  })
  it('monthly template reads back through the upload reader', async () => {
    const read = await roundTrip('monthly')
    expect(read.error).toBeNull()
    expect(read.kind).toBe('monthly')
    expect(read.rows[0]).toMatchObject({
      date: '2026-10-12',
      until: '2026-11-09',
      startTime: '09:30',
      endTime: '11:00',
      weekdays: [true, false, false, true, false, false, false],
    })
    expect(read.rows[1]).toMatchObject({ date: '2026-10-13', until: '', weekdays: [false, false, false, false, false, false, false] })
  })
  it('offers Weekly first, as .xlsx files', () => {
    expect(PLAN_XLSX_TEMPLATES.map((t) => [t.kind, t.fileName])).toEqual([
      ['weekly', 'visit-plan-weekly.xlsx'],
      ['monthly', 'visit-plan-monthly.xlsx'],
    ])
  })
})
