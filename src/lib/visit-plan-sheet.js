/**
 * Reading a visit-plan sheet in the browser (spec 2026-10-07 §2, weekly sheet
 * 2026-10-09).
 *
 * Two templates, told apart by their headers (order free, extra columns ignored):
 * - monthly: Employee, Building, Date, Start time, End time, Repeat until, Mon…Sun
 * - weekly:  Employee, Building, Date, Start time, End time, Repeat (weeks)
 * The server re-parses and re-checks everything — this only turns cells into
 * the plain strings the preview endpoint expects.
 */
const pad = (n) => String(n).padStart(2, '0')
const COLUMNS = {
  employee: 'employee',
  building: 'building',
  date: 'date',
  startTime: 'start time',
  endTime: 'end time',
  until: 'repeat until',
}
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
// "Date (*)" — a required-column marker some templates add — still reads as "date".
const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s*\(\*\)\s*$/, '')

// read-excel-file builds dates at UTC midnight and times on 1899-12-30 UTC, so
// read them back in UTC — local getters would shift them by the browser's zone.
export const cellToDate = (v) =>
  v instanceof Date ? `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}` : String(v ?? '').trim()
export const cellToTime = (v) =>
  v instanceof Date ? `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}` : String(v ?? '').trim()
// "Repeat", "Repeat weeks", "Repeat (weeks)", "Weeks" — letters only, so case,
// spaces and brackets don't matter. "Repeat until" is not one of them.
const WEEKS_NAMES = new Set(['repeat', 'repeatweeks', 'repeatweek', 'weeks'])
const isWeeksHeader = (c) => WEEKS_NAMES.has(norm(c).replace(/[^a-z]/g, ''))
export const MAX_REPEAT_WEEKS = 13
export const REPEAT_ERROR = `Repeat must be a whole number of weeks, 1–${MAX_REPEAT_WEEKS}`

/**
 * A Repeat (weeks) cell → { repeatWeeks, repeat, repeatError }. `repeatWeeks`
 * is the cell as read (sent to the server, which re-checks it); `repeat` the
 * number of visits — blank = 1 (that date only); "4.0" from a CSV reads as 4.
 */
function readRepeat(v) {
  const raw = typeof v === 'number' ? v : String(v ?? '').trim()
  const s = String(raw)
  if (s === '') return { repeatWeeks: raw, repeat: 1, repeatError: null }
  const n = /^\d+(\.0+)?$/.test(s) ? Number(s) : NaN
  if (!Number.isInteger(n) || n < 1 || n > MAX_REPEAT_WEEKS) return { repeatWeeks: raw, repeat: null, repeatError: REPEAT_ERROR }
  return { repeatWeeks: raw, repeat: n, repeatError: null }
}

const isYes = (v) => ['y', 'yes', '✓', 'true', '1'].includes(String(v ?? '').trim().toLowerCase())

/**
 * The plan rows from the first sheet carrying the template's header row, and
 * which template it is: `kind` 'weekly' (a Repeat-weeks column) or 'monthly'
 * (Repeat until / weekday columns, or neither — one-off rows). A sheet with
 * both kinds of column is refused rather than guessed.
 */
export function readPlanSheet(sheets) {
  for (const sheet of sheets ?? []) {
    const rows = sheet?.rows ?? []
    const at = rows.findIndex(
      (r) => (r ?? []).some((c) => norm(c) === 'employee') && (r ?? []).some((c) => norm(c) === 'building'),
    )
    if (at === -1) continue
    const header = rows[at].map(norm)
    const col = Object.fromEntries(Object.entries(COLUMNS).map(([k, name]) => [k, header.indexOf(name)]))
    const dayCols = DAYS.map((d) => header.indexOf(d))
    const weeksCol = rows[at].findIndex(isWeeksHeader)
    const monthly = col.until >= 0 || dayCols.some((c) => c >= 0)
    if (weeksCol >= 0 && monthly) {
      return {
        rows: [],
        kind: null,
        error:
          'This sheet has a Repeat (weeks) column and Repeat until / weekday columns. Use one template — weekly or monthly.',
      }
    }
    const kind = weeksCol >= 0 ? 'weekly' : 'monthly'
    const out = []
    rows.slice(at + 1).forEach((r, i) => {
      const cells = r ?? []
      const get = (k) => (col[k] >= 0 ? cells[col[k]] : '')
      const employee = String(get('employee') ?? '').trim()
      const building = String(get('building') ?? '').trim()
      if (!employee && !building) return
      const base = {
        // 1-based sheet row: the header sits at index `at`, data starts one below.
        rowNumber: at + i + 2,
        employee,
        building,
        date: cellToDate(get('date')),
        startTime: cellToTime(get('startTime')),
        endTime: cellToTime(get('endTime')),
      }
      out.push(
        kind === 'weekly'
          ? { ...base, ...readRepeat(cells[weeksCol]) }
          : { ...base, until: cellToDate(get('until')), weekdays: dayCols.map((c) => (c >= 0 ? isYes(cells[c]) : false)) },
      )
    })
    return { rows: out, kind, error: null }
  }
  return {
    rows: [],
    kind: null,
    error: 'No sheet has the template headers (Employee, Building, Date, …). Download the template.',
  }
}

const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
function validDay(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? ymd(dt) : null
}

/** 'YYYY-MM-DD', 'DD-MM-YYYY' or 'DD/MM/YYYY' → 'YYYY-MM-DD'; else null (same as the server). */
export function parseSheetDate(value) {
  const s = String(value ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return validDay(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) return validDay(+m[3], +m[2], +m[1])
  return null
}

/** A weekly row's visits: the date, then the same weekday each following week — n in all. */
export function weeklyDates(date, n) {
  const first = parseSheetDate(date)
  if (!first || !Number.isInteger(n) || n < 1) return []
  const t0 = Date.parse(`${first}T00:00:00Z`)
  return Array.from({ length: n }, (_, i) => ymd(new Date(t0 + i * 7 * 86400000)))
}

/** '2026-11-02' → '2 Nov' — a calendar day, so read it in UTC (no zone shift). */
export const fmtDay = (iso) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''

/** "4 visits · 13 Oct → 3 Nov" for a weekly row's preview. */
export function visitsText(dates) {
  if (!dates?.length) return 'No visits left'
  if (dates.length === 1) return `1 visit · ${fmtDay(dates[0])}`
  return `${dates.length} visits · ${fmtDay(dates[0])} → ${fmtDay(dates[dates.length - 1])}`
}

/**
 * The CSV templates shipped on 8–9 Oct. "Download template" now gives .xlsx
 * files (visit-plan-template.js); these stay as the CSV shape the reader must
 * keep accepting.
 */
export const PLAN_TEMPLATE_CSV = [
  'Employee,Building,Date,Start time,End time,Repeat until,Mon,Tue,Wed,Thu,Fri,Sat,Sun',
  'Prashant Kambale,Silver Oak Pimple Saudagar,02-11-2026,09:30,11:00,30-11-2026,Y,,,Y,,,',
  'Prashant Kambale,Sunit Apartment,03-11-2026,11:30,13:00,,,,,,,,',
].join('\n')

export const MONTHLY_TEMPLATE_CSV = PLAN_TEMPLATE_CSV

export const WEEKLY_TEMPLATE_CSV = [
  'Employee,Building,Date,Start time,End time,Repeat (weeks)',
  'Prashant Kambale,Silver Oak Pimple Saudagar,02-11-2026,09:30,11:00,4',
  'Prashant Kambale,Sunit Apartment,03-11-2026,11:30,13:00,',
].join('\n')

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Radio choices for editing / deleting a visit with later unvisited repeats ([] = don't ask). */
export function seriesChoices(laterCount) {
  if (!Number.isInteger(laterCount) || laterCount < 1) return []
  return [
    { value: 'ONE', label: 'This visit only' },
    { value: 'FOLLOWING', label: `This and the ${plural(laterCount, 'later repeat')}` },
  ]
}

/** " · 2 of the previous holder's visits for this building removed" — a building hand-over; '' for none. */
export const handoverText = (released) =>
  released > 0 ? ` · ${released} of the previous holder's visits for this building removed` : ''

/**
 * Toast after a series edit: "Changed 3 visits · skipped 1 already visited",
 * plus a building hand-over (`released`) and repeats left alone because they
 * belong to someone outside the planner's team (`outOfScope`), when any.
 */
export function seriesResultText(verb, { changed = 0, skipped = 0, released = 0, outOfScope = 0 } = {}) {
  return (
    `${verb} ${plural(changed, 'visit')}` +
    (skipped ? ` · skipped ${skipped} already visited` : '') +
    handoverText(released) +
    (outOfScope ? ` · ${plural(outOfScope, 'repeat')} outside your team left as is` : '')
  )
}
