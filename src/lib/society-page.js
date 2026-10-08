/**
 * View logic for the society page (/societies/[id]): the status strip's
 * facts and alerts, the survey editor's tab counts, which material group
 * opens first, and how much history shows. Pure — no React, no API.
 */

import { MATERIAL_GROUPS, MATERIALS } from '@/lib/society-materials'
import { approvalNotice, istDate } from '@/lib/society'
import { surveyNotice } from '@/lib/society-survey'

const blank = (v) => v == null || String(v).trim() === ''
/** A quantity the surveyor asked for: a whole number above zero. */
const filled = (v) => !blank(v) && /^\d+$/.test(String(v).trim()) && Number(String(v).trim()) > 0

const GROUP_OF = Object.fromEntries(MATERIALS.map((m) => [m.key, m.group]))

// ── Materials ──────────────────────────────────────────────────────────────

/** { groupKey: number of filled items } for every catalogue group. */
export function materialGroupCounts(materials) {
  const m = materials ?? {}
  return Object.fromEntries(MATERIAL_GROUPS.map((g) => [g.key, g.items.filter((item) => filled(m[item.key])).length]))
}

/** How many catalogue items carry a quantity. */
export const materialsFilled = (materials) =>
  Object.values(materialGroupCounts(materials)).reduce((sum, n) => sum + n, 0)

/** The group open when the editor appears: the first with filled items, else Fiber. */
export function defaultOpenGroup(materials) {
  const counts = materialGroupCounts(materials)
  return MATERIAL_GROUPS.find((g) => counts[g.key] > 0)?.key ?? MATERIAL_GROUPS[0].key
}

/** Groups holding an item with an error ({ itemKey: message }) — shown open. */
export function groupsWithErrors(materialErrors) {
  return new Set(
    Object.keys(materialErrors ?? {})
      .map((k) => GROUP_OF[k])
      .filter(Boolean),
  )
}

// ── Survey editor tabs ─────────────────────────────────────────────────────

export const SURVEY_TABS = [
  { key: 'checks', label: 'Checks' },
  { key: 'wings', label: 'Wings & links' },
  { key: 'materials', label: 'Materials' },
]

/** What each tab holds: named wings, non-empty links, filled materials (checks: none). */
export function surveyTabCounts(form) {
  const wings = (form?.wings ?? []).filter((w) => !blank(w.name)).length
  const links = (form?.links ?? []).filter((l) => !(blank(l.from) && blank(l.to) && blank(l.meters))).length
  return { checks: null, wings, links, materials: materialsFilled(form?.materials) }
}

/** Errors per tab from surveyErrors() (null = no save attempt yet). */
export function surveyTabErrors(errors) {
  if (!errors) return { checks: 0, wings: 0, materials: 0 }
  const n = (o) => Object.keys(o ?? {}).length
  return {
    checks: 0,
    wings: n(errors.wings) + n(errors.links) + (errors.formTabs?.wings ?? 0),
    materials: n(errors.materials) + (errors.formTabs?.materials ?? 0),
  }
}

/** After a failed attempt: stay if this tab has errors, else go to the first that does. */
export function firstTabWithErrors(tabErrors, current) {
  if (tabErrors[current] > 0) return current
  return SURVEY_TABS.find((t) => tabErrors[t.key] > 0)?.key ?? current
}

// ── History ────────────────────────────────────────────────────────────────

export const HISTORY_LIMIT = 3

/** The newest `limit` entries unless expanded. */
export function historyView(visits, expanded, limit = HISTORY_LIMIT) {
  const all = visits ?? []
  const shown = expanded ? all : all.slice(0, limit)
  return { shown, total: all.length, hidden: all.length - shown.length, canToggle: all.length > limit }
}

// ── Status strip ───────────────────────────────────────────────────────────

const byOn = (verb, name, at) => (name ? `${verb} by ${name} on ${istDate(at)}` : `${verb} on ${istDate(at)}`)

function surveyFact(survey) {
  switch (survey?.status) {
    case undefined:
    case null:
      return 'Survey not started'
    case 'DRAFT':
      return survey.updatedAt ? `Survey draft saved ${istDate(survey.updatedAt)}` : 'Survey draft'
    case 'SUBMITTED':
      return byOn('Survey sent', survey.submittedBy?.name, survey.submittedAt)
    case 'APPROVED':
      return survey.decidedBy?.name
        ? byOn('Materials approved', survey.decidedBy.name, survey.decidedAt)
        : 'Materials approved'
    default:
      return null // REJECTED — an alert instead
  }
}

const alertOf = ({ tone, title, detail, reason, reasonLabel }) => ({
  tone,
  title,
  detail: detail ?? '',
  ...(reason ? { reason, reasonLabel: reasonLabel ?? 'Reason' } : {}),
})

/**
 * The one strip at the top of the page: `facts` (one wrapped line —
 * "Approved by X on date · Zone Baner · Materials approved · Live since …")
 * and `alerts` that must stand out: waiting for approval (amber), a society
 * or materials rejection with its reason (red), an older materials rejection
 * on a re-saved draft (muted). The survey counts only once approved.
 */
export function statusStrip({ approval, zone, survey, isLive, liveSince, createdBy, createdAt } = {}) {
  const facts = []
  const alerts = []
  const approved = approval?.status === 'APPROVED'

  if (approved) facts.push(byOn('Approved', approval.decidedBy?.name, approval.decidedAt))
  else if (approval?.status === 'PENDING' || approval?.status === 'REJECTED')
    alerts.push(alertOf(approvalNotice(approval, zone)))

  if (zone?.name) facts.push(`Zone ${zone.name}`)

  if (approved) {
    const s = surveyFact(survey)
    if (s) facts.push(s)
    if (survey?.status === 'REJECTED') {
      alerts.push(alertOf({ ...surveyNotice(survey), title: 'Materials rejected' }))
    } else if (survey?.status === 'DRAFT' && survey.rejectReason) {
      alerts.push(alertOf({ tone: 'muted', title: 'Materials were rejected before', reason: survey.rejectReason }))
    }
    if (isLive) facts.push(liveSince ? `Live since ${istDate(liveSince)}` : 'Live')
  }

  if (createdAt) facts.push(byOn('Added', createdBy?.name, createdAt))
  return { facts, alerts }
}
