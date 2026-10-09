/**
 * The downloadable visit-plan templates as real .xlsx sheets (write-excel-file
 * v4 sheet data). Date cells are true dates shown as "12-Oct-2026" — a month
 * name, so no locale can read day and month the wrong way round — and times
 * are time cells shown as "09:30". The example rows are dated from the
 * download day (next Monday / Tuesday) so they're never already past.
 */
const pad = (n) => String(n).padStart(2, '0')
const DATE_FORMAT = 'dd-mmm-yyyy'
const TIME_FORMAT = 'hh:mm'
const DAY_MS = 86400000

const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const utc = (iso) => new Date(`${iso}T00:00:00Z`)
const addDays = (iso, n) => ymd(new Date(utc(iso).getTime() + n * DAY_MS))

/** The first `weekday` (0 = Monday … 6 = Sunday) strictly after `today` ('YYYY-MM-DD'). */
export function nextWeekday(today, weekday) {
  const todayIdx = (utc(today).getUTCDay() + 6) % 7
  return addDays(today, ((weekday - todayIdx + 6) % 7) + 1)
}

const head = (value) => ({ value, fontWeight: 'bold' })
const text = (value) => ({ value, type: String })
const date = (iso) => ({ value: utc(iso), type: Date, format: DATE_FORMAT })
// A time cell is a fraction of a day; read-excel-file gives it back as a Date on 1899-12-30.
const time = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return { value: (h * 60 + m) / 1440, type: Number, format: TIME_FORMAT }
}
const yes = { value: 'Y', type: String }

const EMPLOYEE = 'Prashant Kambale'
// Named sheet, header row frozen.
const SHEET = { sheet: 'Visit plan', stickyRowsCount: 1 }

/** `{ data, options }` for writeXlsxFile(data, options) — `kind` 'weekly' | 'monthly'. */
export function planTemplateSheet(kind, today) {
  const mon = nextWeekday(today, 0)
  const tue = nextWeekday(today, 1)
  const common = [head('Employee'), head('Building'), head('Date'), head('Start time'), head('End time')]
  const commonWidths = [{ width: 22 }, { width: 30 }, { width: 14 }, { width: 11 }, { width: 11 }]
  if (kind === 'weekly') {
    return {
      data: [
        [...common, head('Repeat (weeks)')],
        [text(EMPLOYEE), text('Silver Oak Pimple Saudagar'), date(mon), time('09:30'), time('11:00'), { value: 4, type: Number }],
        [text(EMPLOYEE), text('Sunit Apartment'), date(tue), time('11:30'), time('13:00'), null],
      ],
      options: { ...SHEET, columns: [...commonWidths, { width: 15 }] },
    }
  }
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return {
    data: [
      [...common, head('Repeat until'), ...days.map(head)],
      // Mondays and Thursdays for four weeks.
      [text(EMPLOYEE), text('Silver Oak Pimple Saudagar'), date(mon), time('09:30'), time('11:00'), date(addDays(mon, 28)), yes, null, null, yes, null, null, null],
      [text(EMPLOYEE), text('Sunit Apartment'), date(tue), time('11:30'), time('13:00'), null, null, null, null, null, null, null, null],
    ],
    options: { ...SHEET, columns: [...commonWidths, { width: 14 }, ...days.map(() => ({ width: 6 }))] },
  }
}

/** "Download template" choices — Weekly first. */
export const PLAN_XLSX_TEMPLATES = [
  { kind: 'weekly', label: 'Weekly', hint: 'One date, repeat for N weeks', fileName: 'visit-plan-weekly.xlsx' },
  { kind: 'monthly', label: 'Monthly', hint: 'Weekdays from a date until a date', fileName: 'visit-plan-monthly.xlsx' },
]
