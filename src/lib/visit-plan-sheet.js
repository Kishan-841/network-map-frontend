/**
 * Reading a visit-plan sheet in the browser (spec 2026-10-07 §2).
 *
 * Columns are matched by header name (order free, extra columns ignored):
 * Employee, Building, Date, Start time, End time, Repeat until, Mon…Sun.
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
const isYes = (v) => ['y', 'yes', '✓', 'true', '1'].includes(String(v ?? '').trim().toLowerCase())

/** The plan rows from the first sheet carrying the template's header row. */
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
    const out = []
    rows.slice(at + 1).forEach((r, i) => {
      const cells = r ?? []
      const get = (k) => (col[k] >= 0 ? cells[col[k]] : '')
      const employee = String(get('employee') ?? '').trim()
      const building = String(get('building') ?? '').trim()
      if (!employee && !building) return
      out.push({
        // 1-based sheet row: the header sits at index `at`, data starts one below.
        rowNumber: at + i + 2,
        employee,
        building,
        date: cellToDate(get('date')),
        startTime: cellToTime(get('startTime')),
        endTime: cellToTime(get('endTime')),
        until: cellToDate(get('until')),
        weekdays: dayCols.map((c) => (c >= 0 ? isYes(cells[c]) : false)),
      })
    })
    return { rows: out, error: null }
  }
  return { rows: [], error: 'No sheet has the template headers (Employee, Building, Date, …). Download the template.' }
}

/** '2026-11-02' → '2 Nov' — a calendar day, so read it in UTC (no zone shift). */
export const fmtDay = (iso) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''

export const PLAN_TEMPLATE_CSV = [
  'Employee,Building,Date,Start time,End time,Repeat until,Mon,Tue,Wed,Thu,Fri,Sat,Sun',
  'Prashant Kambale,Silver Oak Pimple Saudagar,02-11-2026,09:30,11:00,30-11-2026,Y,,,Y,,,',
  'Prashant Kambale,Sunit Apartment,03-11-2026,11:30,13:00,,,,,,,,',
].join('\n')
