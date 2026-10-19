/**
 * Reading a customer sheet in the browser (spec 2026-10-17).
 *
 * The ISP's billing export lists subscribers per building. Columns are matched
 * by header TEXT (any order, extra columns ignored) — the same approach as
 * `ImportBuildingsModal` — so a workbook that spreads customers over several
 * sheets, in a different column order, still reads.
 *
 * Nothing here is a rule of its own: the server re-checks the essentials and
 * normalises the mobile again on every write. These helpers only turn cells
 * into the payload the API expects and let the preview say what will happen.
 */

const pad = (n) => String(n).padStart(2, '0')

/**
 * An Indian mobile number as digits: the sheet writes it with the 91 country
 * code, a typed cell may drop it, a form may add +, spaces or dashes. Leading
 * 91 (12 digits) or 0 (11 digits) is stripped, so one person is one key.
 * Mirrors `backend/src/lib/customers.js`.
 */
export function normaliseMobile(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

/** Letters and digits only, lowercased — so "Phase 1" and "phase1" agree. */
export function foldBuildingName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** IST wall-clock → the instant it names. */
const istInstant = (y, mo, d, h, mi, s) => {
  const instant = new Date(
    `${String(y).padStart(4, '0')}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}+05:30`,
  )
  return Number.isNaN(instant.getTime()) ? null : instant
}

/**
 * A sheet date → instant. `read-excel-file` builds a typed date cell as a Date
 * whose **UTC** parts are the sheet's wall-clock, so read them back in UTC
 * (local getters would shift them by the browser's zone) and rebuild with
 * `+05:30`. A text cell is `dd-mm-yyyy [HH:MM[:SS]]`; anything else is `null`
 * (the row still imports, flagged in the preview).
 */
export function parseSheetDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return istInstant(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
    )
  }
  const text = String(value ?? '').trim()
  if (!text) return null
  const dmy = text.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  )
  if (dmy) {
    const [, d, mo, y, h = '0', mi = '0', s = '0'] = dmy
    return istInstant(+y, +mo, +d, +h, +mi, +s)
  }
  const iso = new Date(text)
  return Number.isNaN(iso.getTime()) ? null : iso
}

/** The sheet's own headers, in order — the CSV template's first line. */
export const CUSTOMER_TEMPLATE_HEADERS = [
  'Username',
  'Name',
  'Address',
  'building',
  'Wing',
  'PON NUMBER',
  'OLT',
  'Mobile No.',
  'E-Mail ID',
  'Site',
  'Operator',
  'Zone',
  'Plan Name',
  'Plan Amount',
  'Plan Validity',
  'Auto Renewal',
  'Plan Activation Date',
  'Plan Expiry Date',
  'Status',
  'Customer Ageing',
]

export const CUSTOMER_TEMPLATE_CSV = `${CUSTOMER_TEMPLATE_HEADERS.join(',')}\nRAMESH PATIL,Ramesh Patil,Flat 101,Silver Oak Pimple Saudagar,A,6,DIAMOND ROCK,9867412726,ramesh@example.com,PUNE,MORYA INTERNET,MORYA INTERNET,100MBPS_UL_3M_OTT,499,30,YES,01-09-2026 10:00:00,30-09-2026 23:59:59,Active,0\n`

/**
 * Header text → field, matched anchored so "Name" and "Plan Name" never
 * collide. `networkZone` is the sheet's Zone — an ISP network name, not our
 * `Zone` geography (same word, different thing).
 */
const HEADERS = {
  username: /^user\s*name$/i,
  name: /^(customer\s*)?name$/i,
  address: /^address$/i,
  building: /^building(\s*name)?$/i,
  wing: /^wing(\s*name)?$/i,
  ponNumber: /^pon(\s*(number|no\.?))?$/i,
  olt: /^olt(\s*name)?$/i,
  mobile: /^mobile(\s*(no|number)\.?)?$/i,
  email: /^e-?mail(\s*id)?$/i,
  site: /^site$/i,
  operator: /^operator$/i,
  networkZone: /^zone(\s*name)?$/i,
  planName: /^plan\s*name$/i,
  planAmount: /^plan\s*amount$/i,
  planValidityDays: /^plan\s*validity(\s*days)?$/i,
  autoRenewal: /^auto\s*renewal$/i,
  planActivatedAt: /^(plan\s*)?activation\s*date$/i,
  planExpiresAt: /^(plan\s*)?expiry\s*date$/i,
  status: /^status$/i,
  ageingDays: /^(customer\s*)?ag(ei|i)ng$/i,
}

// A sheet is a customer sheet when its header row carries these three.
const REQUIRED = ['name', 'mobile', 'building']

/** A workbook's sheets, only those that carry the customer header row. */
function readSheets(sheets) {
  const out = []
  for (const sheet of sheets ?? []) {
    const rows = sheet?.rows ?? []
    const at = rows.findIndex((r) => {
      const cells = (r ?? []).map((c) => String(c ?? '').trim())
      return REQUIRED.every((key) => cells.some((c) => HEADERS[key].test(c)))
    })
    if (at === -1) continue
    const header = rows[at].map((c) => String(c ?? '').trim())
    const col = Object.fromEntries(
      Object.entries(HEADERS).map(([key, re]) => [key, header.findIndex((c) => re.test(c))]),
    )
    out.push({ name: sheet.name ?? 'Sheet', rows, at, col })
  }
  return out
}

const text = (v) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
/** A whole number from a cell ('499.0' and 499 both read), else null. */
const wholeNumber = (v) => {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null
  const s = String(v ?? '').trim()
  return /^\d+(\.0+)?$/.test(s) ? Number(s) : null
}
/** YES/NO (case-insensitive) → true/false; anything else → null. */
const yesNo = (v) => {
  const s = String(v ?? '').trim().toUpperCase()
  if (['YES', 'Y', 'TRUE'].includes(s)) return true
  if (['NO', 'N', 'FALSE'].includes(s)) return false
  return null
}

/** One cell value → the field value the API expects (null when blank). */
function fields(cell) {
  return {
    username: text(cell('username')),
    wing: text(cell('wing')),
    ponNumber: text(cell('ponNumber')),
    olt: text(cell('olt')),
    address: text(cell('address')),
    mobile: normaliseMobile(cell('mobile')),
    email: text(cell('email')),
    site: text(cell('site')),
    operator: text(cell('operator')),
    networkZone: text(cell('networkZone')),
    planName: text(cell('planName')),
    planAmount: wholeNumber(cell('planAmount')),
    planValidityDays: wholeNumber(cell('planValidityDays')),
    autoRenewal: yesNo(cell('autoRenewal')),
    planActivatedAt: parseSheetDate(cell('planActivatedAt')),
    planExpiresAt: parseSheetDate(cell('planExpiresAt')),
    status: text(cell('status')),
    ageingDays: wholeNumber(cell('ageingDays')),
  }
}

/** A candidate building, flattened for the picker: id, label, address, zone. */
const candidate = (b) => ({
  id: b.id,
  buildingName: b.buildingName,
  address: b.formattedAddress ?? null,
  zoneName: b.zone?.name ?? null,
})

/**
 * Every distinct building name the sheets name, in sheet order — what the
 * import asks `/customers/building-lookup` about before it can resolve a row.
 */
export function customerBuildingNames(sheets) {
  const names = []
  const seen = new Set()
  for (const sheet of readSheets(sheets)) {
    const col = sheet.col.building
    if (col < 0) continue
    for (const raw of sheet.rows.slice(sheet.at + 1)) {
      const name = text((raw ?? [])[col])
      if (name && !seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }
  }
  return names
}

/**
 * Raw sheets → what the preview shows and what the import posts.
 *
 * `lookup` is the `/customers/building-lookup` answer keyed by the **exact**
 * name strings collected from the sheet (`{ name: { matches: [...] } }`).
 * Every row becomes:
 * - `ready`    — building resolved to one row, fields usable → `buildingId` set
 * - `needsPick` — the name matches 2–3 rows → `candidates` for a dropdown
 * - `skipped`  — no building, no name, no mobile, or a duplicate inside the file
 *
 * `forcedBuilding` (per-building upload: `{ id, buildingName }`) pins every row
 * to that building; a row naming a different one is skipped, not imported.
 * Returns `error` when no sheet has the customer headers at all.
 */
export function mapCustomerSheet(sheets, lookup = {}, forcedBuilding = null) {
  const found = readSheets(sheets)
  if (found.length === 0) {
    return {
      ready: [],
      needsPick: [],
      skipped: [],
      error: 'No sheet has the customer columns (Name, Mobile No., building). Download the template.',
    }
  }

  const ready = []
  const needsPick = []
  const skipped = []
  const seen = new Set()

  for (const sheet of found) {
    const cell = (cells, key) => (sheet.col[key] >= 0 ? cells[sheet.col[key]] : undefined)
    sheet.rows.slice(sheet.at + 1).forEach((raw, i) => {
      const cells = raw ?? []
      const row = sheet.at + i + 2
      const name = text(cell(cells, 'name'))
      const building = text(cell(cells, 'building'))
      const data = fields((key) => cell(cells, key))
      const mobile = data.mobile
      if (!name && !mobile && !building) return
      const label = name || mobile || `row ${row}`
      const skip = (reason) => skipped.push({ row, sheet: sheet.name, name: label, mobile, reason })

      if (!name) return skip('Customer name is missing')
      if (!mobile || mobile.length < 10 || mobile.length > 13) return skip('Mobile number is missing or wrong')

      let buildingId = null
      let buildingName = building
      let candidates = null
      if (forcedBuilding) {
        if (building && foldBuildingName(building) !== foldBuildingName(forcedBuilding.buildingName)) {
          return skip(`Belongs to "${building}" — not this building`)
        }
        buildingId = forcedBuilding.id
        buildingName = forcedBuilding.buildingName
      } else {
        const matches = lookup[building]?.matches ?? []
        if (matches.length === 0) return skip(building ? `No building named "${building}"` : 'Building name is missing')
        if (matches.length === 1) {
          buildingId = matches[0].id
          buildingName = matches[0].buildingName
        } else {
          candidates = matches.map(candidate)
          buildingName = building
        }
      }

      // The same Username twice is one account; with no Username, the same
      // mobile in the same building is one person. Two Usernames on one mobile
      // are two connections — both stay.
      const key = data.username
        ? `u:${data.username}`
        : `${buildingId ?? `name:${foldBuildingName(buildingName)}`}:${mobile}`
      if (seen.has(key)) return skip('Duplicate in this file')
      seen.add(key)

      const entry = { row, sheet: sheet.name, name, ...data, buildingId, buildingName }
      if (candidates) needsPick.push({ ...entry, candidates })
      else ready.push(entry)
    })
  }

  return { ready, needsPick, skipped, error: null }
}

/** The exact object posted per row (the server resolves `wing` itself). */
export function toImportRow(e) {
  return {
    row: e.row,
    sheet: e.sheet,
    buildingId: e.buildingId,
    wing: e.wing ?? null,
    name: e.name,
    mobile: e.mobile,
    username: e.username ?? null,
    address: e.address ?? null,
    email: e.email ?? null,
    site: e.site ?? null,
    operator: e.operator ?? null,
    networkZone: e.networkZone ?? null,
    planName: e.planName ?? null,
    planAmount: e.planAmount ?? null,
    planValidityDays: e.planValidityDays ?? null,
    autoRenewal: e.autoRenewal ?? null,
    planActivatedAt: e.planActivatedAt ?? null,
    planExpiresAt: e.planExpiresAt ?? null,
    status: e.status ?? null,
    ageingDays: e.ageingDays ?? null,
    ponNumber: e.ponNumber ?? null,
    olt: e.olt ?? null,
  }
}

/**
 * Pack rows into requests of at most `max`, keeping each building whole so the
 * server's per-building work never straddles two requests. A building larger
 * than `max` is split into `max`-sized chunks on its own. First-fit-decreasing.
 */
export function batchByBuilding(rows, max = 1000) {
  const groups = new Map()
  for (const r of rows) {
    const k = r.buildingId ?? null
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  const batches = []
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length)
  for (const g of sorted) {
    if (g.length > max) {
      for (let i = 0; i < g.length; i += max) batches.push(g.slice(i, i + max))
      continue
    }
    const fit = batches.find((b) => b.length + g.length <= max)
    if (fit) fit.push(...g)
    else batches.push([...g])
  }
  return batches
}

/** Why the manual form cannot be saved — plain sentences, mirroring the server. */
export function customerFormErrors(form) {
  const errors = []
  if (!String(form?.name ?? '').trim()) errors.push('Customer name is missing')
  const mobile = normaliseMobile(form?.mobile)
  if (!mobile) errors.push('Mobile number is missing')
  else if (mobile.length < 10 || mobile.length > 13) errors.push('Mobile number looks wrong')
  const email = String(form?.email ?? '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email address looks wrong')
  return errors
}
