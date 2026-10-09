/**
 * Dates in an uploaded visit plan, as the browser read them — and help when a
 * spreadsheet swapped day and month.
 *
 * Excel set to a US locale stores a typed "02/11/2026" (meant: 2 Nov) as
 * 11 Feb 2026. The preview then says "Date has passed" for a row the planner
 * thinks is fine. Here we show the date as read and, when reading it the other
 * way round gives a day today or later, suggest that — the planner applies it
 * and checks the sheet again; nothing is ever swapped silently.
 */
import { parseSheetDate } from './visit-plan-sheet'

const pad = (n) => String(n).padStart(2, '0')
const IST_OFFSET_MS = 5.5 * 3600 * 1000
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

/** Today's calendar day in India ('YYYY-MM-DD') — the day the server checks against. */
export const istToday = (now = new Date()) => ymd(new Date(now.getTime() + IST_OFFSET_MS))

function validDay(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? ymd(dt) : null
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A sheet date cell → 'Wed 11 Feb 2026'; null when it is not a date. */
export function fmtLongDay(value) {
  const iso = parseSheetDate(value)
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00Z`)
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/**
 * The same cell read with day and month the other way round ('YYYY-MM-DD'),
 * or null when there is no other reading:
 * - a real date: only when day and month are both 12 or less and differ;
 * - a D/M/Y text that is not a date as read (month over 12, e.g. "11/13/2026"
 *   or "02/29/2028" typed month-first): read month-first instead.
 */
export function swapDayMonth(value) {
  const read = parseSheetDate(value)
  if (read) {
    const [y, m, d] = read.split('-').map(Number)
    if (d > 12 || d === m) return null
    return validDay(y, d, m)
  }
  const t = String(value ?? '').trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  return t ? validDay(+t[3], +t[1], +t[2]) : null
}

/**
 * The swapped date to suggest for a Date cell, or null: only when the cell has
 * passed (or is not a date as read) and the swapped reading is `today` or later.
 */
export function suggestDateSwap(value, today) {
  const read = parseSheetDate(value)
  if (read && read >= today) return null
  const swapped = swapDayMonth(value)
  return swapped && swapped >= today ? swapped : null
}

/**
 * A row's suggested swap: `{ date: { from, to }, until?: { from, to } }` or null.
 * A monthly row's Repeat until is swapped the same way only when it has another
 * reading that lands on or after the new Date — e.g. "30-11-2026" cannot swap
 * and stays. No suggestion when the new Date would fall after an until that
 * stays (2 Oct … 30 Nov is a plan that started earlier, not a swap).
 */
export function rowDateSwap(row, today) {
  const to = suggestDateSwap(row?.date, today)
  if (!to) return null
  const out = { date: { from: row.date, to } }
  if ('until' in row && String(row.until ?? '').trim()) {
    const until = swapDayMonth(row.until)
    if (until && until >= to) out.until = { from: row.until, to: until }
    else {
      // A real Repeat until that the new Date would overshoot: the row more
      // likely started in the past on purpose (past days are skipped) — no hint.
      const read = parseSheetDate(row.until)
      if (read && read < to) return null
    }
  }
  return out
}

/** Every suggested swap applied → `{ rows, swapped }`; untouched rows keep their object. */
export function applyDateSwaps(rows, today) {
  const swapped = {}
  const out = (rows ?? []).map((row) => {
    const s = rowDateSwap(row, today)
    if (!s) return row
    swapped[row.rowNumber] = s
    return { ...row, date: s.date.to, ...(s.until ? { until: s.until.to } : {}) }
  })
  return { rows: out, swapped }
}
