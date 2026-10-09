process.env.TZ = 'Asia/Kolkata'

import { describe, it, expect } from 'vitest'
import {
  istToday,
  fmtLongDay,
  swapDayMonth,
  suggestDateSwap,
  rowDateSwap,
  applyDateSwaps,
} from '../plan-sheet-dates'

const TODAY = '2026-10-09'

describe('reading dates', () => {
  it('today is the IST calendar day', () => {
    // 20:00 UTC on 8 Oct is 01:30 on 9 Oct in India.
    expect(istToday(new Date(Date.UTC(2026, 9, 8, 20, 0)))).toBe('2026-10-09')
    expect(istToday(new Date(Date.UTC(2026, 9, 8, 10, 0)))).toBe('2026-10-08')
  })
  it('formats a day in full with its weekday, no zone shift', () => {
    expect(fmtLongDay('2026-02-11')).toBe('Wed 11 Feb 2026')
    expect(fmtLongDay('2026-11-02')).toBe('Mon 2 Nov 2026')
    expect(fmtLongDay('02-11-2026')).toBe('Mon 2 Nov 2026')
    expect(fmtLongDay('garbage')).toBeNull()
    expect(fmtLongDay('')).toBeNull()
  })
})

describe('day/month swap', () => {
  it('swaps a real date whose day and month are both 12 or less', () => {
    expect(swapDayMonth('2026-02-11')).toBe('2026-11-02')
    expect(swapDayMonth('02-11-2026')).toBe('2026-02-11')
  })
  it('has no swap when the day is over 12 or day = month', () => {
    expect(swapDayMonth('2026-10-13')).toBeNull()
    expect(swapDayMonth('2026-05-05')).toBeNull()
  })
  it('reads an invalid D/M text the other way round (typed month-first)', () => {
    expect(swapDayMonth('11/13/2026')).toBe('2026-11-13')
  })
  it('leap day: 02/29 month-first is real only in a leap year', () => {
    expect(swapDayMonth('02/29/2028')).toBe('2028-02-29')
    expect(swapDayMonth('02/29/2027')).toBeNull()
  })
  it('suggests 2 Nov 2026 for an 11 Feb 2026 cell on 9 Oct 2026', () => {
    expect(suggestDateSwap('2026-02-11', TODAY)).toBe('2026-11-02')
    expect(suggestDateSwap('2026-03-11', TODAY)).toBe('2026-11-03')
  })
  it('13 Oct stays: nothing to swap, and it is not past anyway', () => {
    expect(suggestDateSwap('2026-10-13', TODAY)).toBeNull()
    expect(suggestDateSwap('2026-09-13', TODAY)).toBeNull()
  })
  it('no suggestion when the date is today or later', () => {
    expect(suggestDateSwap('2026-11-02', TODAY)).toBeNull()
    expect(suggestDateSwap(TODAY, TODAY)).toBeNull()
  })
  it('no suggestion when the swap would still be in the past', () => {
    // 5 Jan 2026 ↔ 1 May 2026 — both passed.
    expect(suggestDateSwap('2026-01-05', TODAY)).toBeNull()
  })
  it('no suggestion for a day over 12', () => {
    expect(suggestDateSwap('2026-02-13', TODAY)).toBeNull()
  })
  it('leap day: a month-first 02/29 text that is invalid as read', () => {
    expect(suggestDateSwap('02/29/2028', TODAY)).toBe('2028-02-29')
    expect(suggestDateSwap('02/29/2027', TODAY)).toBeNull()
  })
  it('the swapped day may be today', () => {
    // 10 Sep ↔ 9 Oct: fine on 9 Oct, past on 10 Oct.
    expect(suggestDateSwap('2026-09-10', '2026-10-09')).toBe('2026-10-09')
    expect(suggestDateSwap('2026-09-10', '2026-10-10')).toBeNull()
  })
})

describe('row swaps', () => {
  const weekly = { rowNumber: 2, employee: 'A', building: 'B', date: '2026-02-11', startTime: '', endTime: '', repeatWeeks: 4, repeat: 4, repeatError: null }
  const monthly = (date, until) => ({ rowNumber: 3, employee: 'A', building: 'B', date, until, startTime: '', endTime: '', weekdays: [true, false, false, false, false, false, false] })

  it('weekly: swaps only the date', () => {
    expect(rowDateSwap(weekly, TODAY)).toEqual({ date: { from: '2026-02-11', to: '2026-11-02' } })
  })
  it('monthly: swaps the until the same way when that makes sense', () => {
    // 2 Nov … 12 Nov typed month-first → 11 Feb … 11 Dec as read.
    expect(rowDateSwap(monthly('2026-02-11', '2026-12-11'), TODAY)).toEqual({
      date: { from: '2026-02-11', to: '2026-11-02' },
      until: { from: '2026-12-11', to: '2026-11-12' },
    })
  })
  it('monthly: leaves an until that cannot swap (30 Nov) alone', () => {
    expect(rowDateSwap(monthly('2026-02-11', '2026-11-30'), TODAY)).toEqual({ date: { from: '2026-02-11', to: '2026-11-02' } })
  })
  it('monthly: no hint when the swapped date would overshoot an until that stays', () => {
    // until 1 Oct ↔ 10 Jan: neither is on or after 2 Nov — the swap would break the row.
    expect(rowDateSwap(monthly('2026-02-11', '2026-10-01'), TODAY)).toBeNull()
    // 12 Sep … 30 Nov started earlier on purpose; 9 Dec would be after the until.
    expect(rowDateSwap(monthly('2026-09-12', '2026-11-30'), TODAY)).toBeNull()
    // 11 Sep → 9 Nov still sits inside … 30 Nov: hint, until unchanged.
    expect(rowDateSwap(monthly('2026-09-11', '2026-11-30'), TODAY)).toEqual({ date: { from: '2026-09-11', to: '2026-11-09' } })
    // …and with no until at all, the hint stays.
    expect(rowDateSwap(monthly('2026-09-12', ''), TODAY)).toEqual({ date: { from: '2026-09-12', to: '2026-12-09' } })
  })
  it('no swap for a ready row', () => {
    expect(rowDateSwap(monthly('2026-11-02', ''), TODAY)).toBeNull()
  })
  it('applies every suggestion to new row objects and lists them', () => {
    const rows = [weekly, { ...weekly, rowNumber: 5, date: '2026-10-13' }]
    const out = applyDateSwaps(rows, TODAY)
    expect(out.rows[0]).toEqual({ ...weekly, date: '2026-11-02' })
    expect(out.rows[1]).toBe(rows[1])
    expect(rows[0].date).toBe('2026-02-11')
    expect(out.swapped).toEqual({ 2: { date: { from: '2026-02-11', to: '2026-11-02' } } })
  })
  it('monthly apply rewrites the until too', () => {
    const out = applyDateSwaps([monthly('2026-02-11', '2026-12-11')], TODAY)
    expect(out.rows[0]).toMatchObject({ date: '2026-11-02', until: '2026-11-12' })
  })
})
