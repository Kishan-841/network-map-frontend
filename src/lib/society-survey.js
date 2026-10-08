/**
 * Society permissions, phase 3: the zone surveyor's site survey + material
 * request on an approved society. The form keeps every number as a string
 * (what an <input> holds); `surveyPayload` turns it into the PUT body and
 * `surveyErrors` mirrors the API's checks so mistakes show before a save.
 */

import { MATERIAL_KEYS } from '@/lib/society-materials'
import { istDate } from '@/lib/society'

export const LINK_METHODS = [
  { value: 'AERIAL', label: 'Aerial' },
  { value: 'UNDERGROUND', label: 'Underground' },
  { value: 'TRAY', label: 'Tray' },
]
export const linkMethodLabel = (v) => LINK_METHODS.find((m) => m.value === v)?.label ?? v ?? ''

export const MAX_WINGS = 26
export const MAX_LINKS = 50
export const MAX_QTY = 100000
const WING_NAME_MAX = 20
export const MAX_METERS = 100000
// [field, label, cap] — the API's caps per wing.
const WING_NUMBERS = [
  ['floors', 'Floors', 300],
  ['flatsPerFloor', 'Flats per floor', 200],
  ['shafts', 'Shafts', 100],
  ['homePass', 'Home pass', 100000],
]

/**
 * Every wing and link row carries a random id: React keys stay stable when a
 * row above is removed, and a link points at its wings BY ID, so renaming a
 * wing (even clearing the name to retype it) carries through to its links.
 * Random, not a counter, so a draft restored after a reload cannot collide
 * with rows added afterwards.
 */
const rowId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`

export const emptyWing = () => ({ id: rowId('w'), name: '', floors: '', flatsPerFloor: '', shafts: '', homePass: '', homePassEdited: false })
/** `from` / `to` hold wing row ids ('' = not picked). */
export const emptyLink = () => ({ id: rowId('l'), from: '', to: '', method: 'AERIAL', meters: '' })

/** Remove a wing row; its links lose that end (and are then flagged to fix). */
export function removeWingAt(form, index) {
  const gone = form.wings[index]?.id
  return {
    ...form,
    wings: form.wings.filter((_, i) => i !== index),
    links: form.links.map((l) => ({ ...l, from: l.from === gone ? '' : l.from, to: l.to === gone ? '' : l.to })),
  }
}

const blank = (v) => v == null || String(v).trim() === ''
const str = (v) => (v == null ? '' : String(v))
/** '' → null; a whole number ≥ 0 → that number; anything else → NaN. */
function toInt(v) {
  if (blank(v)) return null
  const s = String(v).trim()
  return /^\d+$/.test(s) ? Number(s) : NaN
}
const okInt = (v, max = Infinity) => {
  const n = toInt(v)
  return n === null || (Number.isInteger(n) && n <= max)
}
/** Link metres: blank, or a number 0–100000 (decimals allowed). */
function toMeters(v) {
  if (blank(v)) return null
  const s = String(v).trim()
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN
}
const okMeters = (v) => {
  const n = toMeters(v)
  return n === null || (Number.isFinite(n) && n <= MAX_METERS)
}

/** floors × flats per floor, as the input string ('' until both are whole numbers). */
function defaultHomePass(w) {
  const floors = toInt(w.floors)
  const flats = toInt(w.flatsPerFloor)
  return Number.isInteger(floors) && Number.isInteger(flats) ? String(floors * flats) : ''
}

/**
 * Change one field of a wing row. The home pass follows floors × flats per
 * floor until the surveyor types their own; clearing it hands it back.
 */
export function setWingField(wing, field, value) {
  const next = { ...wing, [field]: value }
  if (field === 'homePass') {
    next.homePassEdited = !blank(value)
    if (!next.homePassEdited) next.homePass = defaultHomePass(next)
    return next
  }
  if (!next.homePassEdited) next.homePass = defaultHomePass(next)
  return next
}

const wingIsEmpty = (w) => blank(w.name) && ['floors', 'flatsPerFloor', 'shafts'].every((k) => blank(w[k])) && (!w.homePassEdited || blank(w.homePass))
const linkIsEmpty = (l) => blank(l.from) && blank(l.to) && blank(l.meters)

/** wing row id → its trimmed name, for the wings that will be sent (named, not empty). */
function wingNamesById(wings) {
  const map = new Map()
  for (const w of wings ?? []) {
    const name = String(w.name ?? '').trim()
    if (!wingIsEmpty(w) && name) map.set(w.id, name)
  }
  return map
}

/** A saved survey (or null) as the editor's form. */
export function surveyToForm(survey) {
  const c = survey?.checks ?? {}
  const wings = (survey?.wings ?? []).map((w) => {
    const row = {
      id: rowId('w'),
      name: str(w.name),
      floors: str(w.floors),
      flatsPerFloor: str(w.flatsPerFloor),
      shafts: str(w.shafts),
      homePass: str(w.homePass),
      homePassEdited: false,
    }
    row.homePassEdited = row.homePass !== defaultHomePass(row)
    return row
  })
  return {
    checks: {
      nameOk: c.nameOk ?? true,
      nameCorrection: str(c.nameCorrection),
      wingsOk: c.wingsOk ?? true,
      homePassOk: c.homePassOk ?? true,
      note: str(c.note),
    },
    wings: wings.length ? wings : [emptyWing()],
    links: (survey?.links ?? []).map((l) => {
      const idOf = (name) => wings.find((w) => w.name.trim().toLowerCase() === str(name).trim().toLowerCase())?.id ?? ''
      return { id: rowId('l'), from: idOf(l.from), to: idOf(l.to), method: str(l.method), meters: str(l.meters) }
    }),
    materials: Object.fromEntries(
      Object.entries(survey?.materials ?? {})
        .filter(([, qty]) => Number(qty) > 0)
        .map(([key, qty]) => [key, String(qty)]),
    ),
  }
}

/** The PUT …/survey body: empty rows dropped, numbers as ints, only materials asked for. */
export function surveyPayload(form) {
  const c = form.checks ?? {}
  const checks = { nameOk: Boolean(c.nameOk), wingsOk: Boolean(c.wingsOk), homePassOk: Boolean(c.homePassOk) }
  if (!c.nameOk && !blank(c.nameCorrection)) checks.nameCorrection = String(c.nameCorrection).trim()
  if (!blank(c.note)) checks.note = String(c.note).trim()

  const wings = (form.wings ?? [])
    .filter((w) => !wingIsEmpty(w))
    .map((w) => {
      const homePass = w.homePassEdited && !blank(w.homePass) ? w.homePass : defaultHomePass(w)
      return {
        name: String(w.name).trim(),
        floors: toInt(w.floors) ?? 0,
        flatsPerFloor: toInt(w.flatsPerFloor) ?? 0,
        shafts: toInt(w.shafts) ?? 0,
        homePass: toInt(homePass) ?? 0,
      }
    })

  const names = wingNamesById(form.wings)
  const links = (form.links ?? [])
    .filter((l) => !linkIsEmpty(l))
    .map((l) => {
      const meters = toMeters(l.meters)
      return {
        from: names.get(l.from) ?? '',
        to: names.get(l.to) ?? '',
        method: l.method,
        ...(meters !== null ? { meters } : {}),
      }
    })

  const materials = {}
  for (const key of MATERIAL_KEYS) {
    const n = toInt(form.materials?.[key])
    if (Number.isInteger(n) && n > 0) materials[key] = n
  }
  return { checks, wings, links, materials }
}

/**
 * Mistakes the API would refuse, per row: { ok, form: [messages],
 * wings: {index: message}, links: {index: message}, materials: {key: message} }.
 * `submit` adds the submit-only rules (≥1 wing, ≥1 material).
 */
export function surveyErrors(form, { submit = false } = {}) {
  const out = { form: [], wings: {}, links: {}, materials: {} }
  const wings = form.wings ?? []
  const seen = new Set()
  let wingCount = 0
  wings.forEach((w, i) => {
    if (wingIsEmpty(w)) return
    wingCount += 1
    const name = String(w.name ?? '').trim()
    const lower = name.toLowerCase()
    let msg = ''
    if (!name) msg = 'Give this wing a name'
    else if (name.length > WING_NAME_MAX) msg = `Wing name: ${WING_NAME_MAX} characters at most`
    else if (seen.has(lower)) msg = `Wing “${name}” is listed twice`
    if (name) seen.add(lower)
    if (!msg) {
      const notInt = WING_NUMBERS.find(([k]) => !Number.isInteger(toInt(w[k])) && toInt(w[k]) !== null)
      const tooBig = WING_NUMBERS.find(([k, , cap]) => !okInt(w[k], cap))
      if (notInt) msg = `${notInt[1]} must be a whole number`
      else if (tooBig) msg = `${tooBig[1]}: ${tooBig[2]} at most`
    }
    if (msg) out.wings[i] = msg
  })
  if (wingCount > MAX_WINGS) out.form.push(`${MAX_WINGS} wings at most`)

  const names = wingNamesById(wings)
  const links = form.links ?? []
  let linkCount = 0
  // A run between two wings is listed once per method, whichever way round.
  const runs = new Set()
  links.forEach((l, i) => {
    if (linkIsEmpty(l)) return
    linkCount += 1
    let msg = ''
    if (!names.has(l.from) || !names.has(l.to)) msg = 'Pick both wings from the list'
    else if (l.from === l.to || names.get(l.from).toLowerCase() === names.get(l.to).toLowerCase())
      msg = 'A link joins two different wings'
    else if (!LINK_METHODS.some((m) => m.value === l.method)) msg = 'Pick how the wings are linked'
    else if (!okMeters(l.meters)) msg = `Metres: a number up to ${MAX_METERS}`
    if (!msg) {
      const ends = [names.get(l.from).toLowerCase(), names.get(l.to).toLowerCase()].sort()
      const run = [...ends, l.method].join('\u0000')
      if (runs.has(run)) msg = 'That link is already listed'
      runs.add(run)
    }
    if (msg) out.links[i] = msg
  })
  if (linkCount > MAX_LINKS) out.form.push(`${MAX_LINKS} links at most`)

  let asked = 0
  for (const [key, v] of Object.entries(form.materials ?? {})) {
    if (!okInt(v, MAX_QTY)) out.materials[key] = `Whole number, 0–${MAX_QTY}`
    else if (MATERIAL_KEYS.includes(key) && toInt(v) > 0) asked += 1
  }

  if (submit) {
    if (wingCount === 0) out.form.push('Add at least one wing')
    if (asked === 0) out.form.push('Ask for at least one material')
  }
  const ok =
    out.form.length === 0 &&
    Object.keys(out.wings).length === 0 &&
    Object.keys(out.links).length === 0 &&
    Object.keys(out.materials).length === 0
  return { ok, ...out }
}

const STATUS_LABEL = {
  DRAFT: 'Draft',
  SUBMITTED: 'Waiting for admin',
  APPROVED: 'Materials approved',
  REJECTED: 'Rejected',
}
export const surveyStatusLabel = (s) => (s ? (STATUS_LABEL[s] ?? s) : 'Not started')

/**
 * The status box above the survey: { tone: 'muted'|'warn'|'bad'|'ok', title,
 * detail, reason? }. `liveSince` is when it was marked live (if known).
 */
export function surveyNotice(survey, isLive = false, liveSince = null) {
  if (!survey?.status) return { tone: 'muted', title: 'Survey not started', detail: '' }
  const decided = survey.decidedBy?.name
    ? `${survey.decidedBy.name} on ${istDate(survey.decidedAt)}`
    : `on ${istDate(survey.decidedAt)}`
  switch (survey.status) {
    case 'DRAFT':
      // A re-saved rejection is a draft again; the API keeps the reason until approval.
      return {
        tone: 'muted',
        title: 'Draft — not sent yet',
        detail: survey.updatedAt ? `Saved ${istDate(survey.updatedAt)}` : '',
        ...(survey.rejectReason ? { reason: survey.rejectReason, reasonLabel: 'Rejected before' } : {}),
      }
    case 'SUBMITTED':
      return {
        tone: 'warn',
        title: 'Waiting for admin',
        detail: survey.submittedBy?.name
          ? `Sent by ${survey.submittedBy.name} on ${istDate(survey.submittedAt)}`
          : `Sent on ${istDate(survey.submittedAt)}`,
      }
    case 'REJECTED':
      return {
        tone: 'bad',
        title: 'Rejected',
        detail: [survey.decidedBy?.name, istDate(survey.decidedAt)].filter(Boolean).join(' · '),
        reason: survey.rejectReason ?? '',
      }
    case 'APPROVED':
      if (isLive) {
        const since = liveSince ? `Live since ${istDate(liveSince)} · ` : ''
        return { tone: 'ok', title: 'Live', detail: `${since}materials approved by ${decided}` }
      }
      return { tone: 'ok', title: 'Materials approved', detail: survey.decidedBy?.name ? `By ${decided}` : `On ${istDate(survey.decidedAt)}` }
    default:
      return { tone: 'muted', title: surveyStatusLabel(survey.status), detail: '' }
  }
}

// ── Progress: one chip for where a society is in the whole flow ────────────
export const PROGRESS_FILTER_OPTIONS = [
  { value: 'APPROVAL_PENDING', label: 'Waiting for approval' },
  { value: 'APPROVED_NO_SURVEY', label: 'Survey to do (not started, draft, rejected)' },
  { value: 'SURVEY_SUBMITTED', label: 'Survey submitted' },
  { value: 'MATERIALS_APPROVED', label: 'Materials approved' },
  { value: 'LIVE', label: 'Live' },
]
export const PROGRESS_STEPS = 5

const P = (stage, label, className, step) => ({ stage, label, className, step })
/**
 * Waiting for approval → Approved → Survey submitted → Materials approved →
 * Live, with the rejections in red. `step` (0–5) fills a small progress bar.
 */
export function societyProgress({ approval, survey, isLive } = {}) {
  if (isLive && survey?.status === 'APPROVED') return P('LIVE', 'Live', 'bg-ok text-white', 5)
  const a = approval?.status
  if (!a) return P('NOT_SENT', 'Not sent', 'bg-paper text-muted', 0)
  if (a === 'PENDING') return P('APPROVAL_PENDING', 'Waiting for approval', 'bg-warn-tint text-warn', 1)
  if (a === 'REJECTED') return P('APPROVAL_REJECTED', 'Rejected', 'bg-bad-tint text-bad', 1)
  if (isLive) return P('LIVE', 'Live', 'bg-ok text-white', 5)
  switch (survey?.status) {
    case 'DRAFT':
      return P('APPROVED_NO_SURVEY', 'Survey draft', 'bg-fiber-tint text-fiber', 2)
    case 'SUBMITTED':
      return P('SURVEY_SUBMITTED', 'Survey submitted', 'bg-warn-tint text-warn', 3)
    case 'REJECTED':
      return P('SURVEY_REJECTED', 'Materials rejected', 'bg-bad-tint text-bad', 3)
    case 'APPROVED':
      return P('MATERIALS_APPROVED', 'Materials approved', 'bg-ok-tint text-ok', 4)
    default:
      return P('APPROVED_NO_SURVEY', 'Approved · survey pending', 'bg-fiber-tint text-fiber', 2)
  }
}

/**
 * 'edit' | 'edit-remark' | 'read'. The zone surveyor edits until the admin
 * approves the materials; the admin edits any time, with a remark once
 * approved (the API logs it). Everyone else reads.
 */
export function surveyEditMode(role, survey, isLive = false) {
  const approved = survey?.status === 'APPROVED'
  if (role === 'ADMIN') return approved ? 'edit-remark' : 'edit'
  // Once live the API refuses the surveyor's saves (409 "Already live").
  if (role === 'SURVEYOR') return approved || isLive ? 'read' : 'edit'
  return 'read'
}

/**
 * The admin's remark on a survey edit: 'required' once approved, 'optional'
 * while it waits (both are logged as SURVEY_EDITED), or null — on a draft or
 * a rejected survey the API records no remark, so none is asked for.
 */
export function surveyRemarkField(role, survey) {
  if (role !== 'ADMIN') return null
  if (survey?.status === 'APPROVED') return 'required'
  if (survey?.status === 'SUBMITTED') return 'optional'
  return null
}

/** Submit is open from no survey yet, a draft, or a rejection. */
export const canSubmitSurvey = (role, survey) =>
  (role === 'ADMIN' || role === 'SURVEYOR') && (!survey?.status || survey.status === 'DRAFT' || survey.status === 'REJECTED')

export const canDecideSurvey = (role, survey) => role === 'ADMIN' && survey?.status === 'SUBMITTED'

/** Mark live: the zone surveyor or the admin, once the materials are approved. */
export const canMarkLive = (role, survey, isLive) =>
  (role === 'ADMIN' || role === 'SURVEYOR') && survey?.status === 'APPROVED' && !isLive

// ── Unsaved edits ──────────────────────────────────────────────────────────

/** What a form says, without row ids or blank quantities — for "is it changed?". */
function formSignature(form) {
  const nameOf = new Map((form.wings ?? []).map((w) => [w.id, String(w.name ?? '').trim()]))
  return JSON.stringify({
    checks: form.checks,
    wings: (form.wings ?? []).map(({ id, ...rest }) => rest),
    links: (form.links ?? []).map((l) => [nameOf.get(l.from) ?? '', nameOf.get(l.to) ?? '', l.method, String(l.meters ?? '')]),
    materials: Object.fromEntries(
      Object.entries(form.materials ?? {})
        .filter(([, v]) => !blank(v))
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  })
}
/** True when the form holds edits that are not in `initial` (what was loaded). */
export const isFormDirty = (form, initial) => formSignature(form) !== formSignature(initial)

/**
 * An unsaved survey is kept in sessionStorage (this tab, this device) per
 * user and building, so Back, a nav tap or a reload does not lose it. Every
 * access is guarded: storage may be missing or throw (private mode, blocked
 * site data) — then there is simply no draft.
 */
export const surveyDraftKey = (buildingId, userId) => `society-survey-draft:${userId}:${buildingId}`

/** `basedOn` = the saved survey's updatedAt ('new' when none), so a stale draft is never restored. */
export function saveDraft(storage, key, form, basedOn) {
  try {
    storage?.setItem(key, JSON.stringify({ basedOn, form }))
  } catch {
    // no storage — nothing kept
  }
}
export function loadDraft(storage, key, basedOn) {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (d?.basedOn !== basedOn || !d.form?.checks || !Array.isArray(d.form.wings) || !Array.isArray(d.form.links)) return null
    return d.form
  } catch {
    return null
  }
}
export function clearDraft(storage, key) {
  try {
    storage?.removeItem(key)
  } catch {
    // nothing to clear
  }
}
export function hasDraft(storage, key) {
  try {
    return Boolean(storage?.getItem(key))
  } catch {
    return false
  }
}
/** The browser's sessionStorage, or null (server render, or access refused). */
export function sessionStore() {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}
