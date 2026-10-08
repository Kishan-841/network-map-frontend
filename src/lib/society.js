/**
 * The society-permission capture (Permission Executive). Option lists in the
 * sales person's words, a payload builder that maps the flat form to the
 * POST /buildings body, and the required-field check. Kept pure and tested.
 */

import { designationLabel } from '@/lib/roles'

export const PERMISSION_STATUS_OPTIONS = [
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'FOLLOW_UP', label: 'Follow up' },
  { value: 'DENIED', label: 'Society denied' },
]
export const SOCIETY_OFFER_OPTIONS = [
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'DEMO', label: 'Demo connection' },
]
export const PAYMENT_TYPE_OPTIONS = [
  { value: 'ONE_TIME', label: 'One time' },
  { value: 'RECURRING', label: 'Recurring' },
]

export const permissionStatusLabel = (v) =>
  PERMISSION_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v ?? ''

const STATUS_BADGE = {
  ACCEPTED: 'bg-ok-tint text-ok',
  FOLLOW_UP: 'bg-warn-tint text-warn',
  DENIED: 'bg-bad-tint text-bad',
}
/** Chip classes for a permission status; no status reads as a neutral chip. */
export const permissionStatusBadge = (v) => STATUS_BADGE[v] ?? 'bg-paper text-muted'

const KIND_LABEL = {
  ADDED: 'Added',
  VISIT: 'Visit',
  EDIT: 'Edit',
  // Phase 2: the admin-approval trail.
  SUBMITTED: 'Sent for approval',
  WITHDRAWN: 'Withdrawn',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  // Phase 3: the site survey + material request, and going live.
  SURVEY_SAVED: 'Survey saved',
  SURVEY_SUBMITTED: 'Survey submitted',
  SURVEY_EDITED: 'Survey edited',
  MATERIALS_APPROVED: 'Materials approved',
  MATERIALS_REJECTED: 'Materials rejected',
  MARKED_LIVE: 'Marked live',
}
/** A history row's kind (PermissionVisit.kind) in words. */
export const visitKindLabel = (k) => KIND_LABEL[k] ?? k ?? ''

/**
 * The extra line an approval-trail row carries: an approval names its zone.
 * The APPROVED row itself has no zone, so it is the society's zone (`zone`)
 * — approval is final, so there is only ever one such row.
 */
export function historyDetail(v, zone) {
  const name = v?.zone?.name ?? zone?.name
  if (v?.kind === 'APPROVED' && name) return `Zone: ${name}`
  return ''
}

// The API's stable change keys (PATCH /buildings/:id on a PERMISSION building).
const CHANGE_LABEL = {
  name: 'Name',
  address: 'Address',
  location: 'Location',
  zone: 'Zone',
  live: 'Live',
  details: 'Building details',
  contact: 'Person met',
  status: 'Status',
  offer: 'Offer',
  permission: 'Permission details',
  photos: 'Photos',
  // SURVEY_EDITED rows: which parts of the survey changed.
  checks: 'Checks',
  wings: 'Wings',
  links: 'Wing links',
  materials: 'Materials',
}
/** Words for an edit's changed-field keys; an unknown key reads straight back. */
export const changeLabels = (keys) => (keys ?? []).map((k) => CHANGE_LABEL[k] ?? k)

/** "Follow up → Accepted", or just the new status when there was none before. */
export function statusChangeText(before, after) {
  if (!after) return ''
  return before ? `${permissionStatusLabel(before)} → ${permissionStatusLabel(after)}` : permissionStatusLabel(after)
}

/**
 * Split a stored photo set into the form's two fields and every other photo,
 * which an edit must send back untouched (PATCH takes the FULL desired set).
 */
export function photosToForm(photos) {
  const list = photos ?? []
  const first = (type) => list.find((p) => p.type === type)?.url ?? ''
  return {
    entrancePhotoUrl: first('ENTRANCE'),
    permissionLetterUrl: first('PERMISSION_LETTER'),
    otherPhotos: list
      .filter((p) => p.type !== 'ENTRANCE' && p.type !== 'PERMISSION_LETTER')
      .map((p) => ({ type: p.type, url: p.url })),
  }
}

const num = (v) => {
  const n = Number(v)
  return v === '' || v == null || Number.isNaN(n) ? undefined : n
}

/** Turn the flat capture form into the POST /buildings body. */
export function buildSocietyPayload(f) {
  const isPayment = f.societyOffer === 'PAYMENT'
  const isDemo = f.societyOffer === 'DEMO'
  const photos = []
  if (f.entrancePhotoUrl) photos.push({ type: 'ENTRANCE', url: f.entrancePhotoUrl })
  if (f.permissionLetterUrl) photos.push({ type: 'PERMISSION_LETTER', url: f.permissionLetterUrl })
  return {
    placeId: f.placeId || undefined,
    buildingName: f.buildingName.trim(),
    formattedAddress: f.formattedAddress,
    latitude: f.latitude,
    longitude: f.longitude,
    zoneId: f.zoneId || undefined,
    details: {
      ...(num(f.wings) !== undefined ? { wings: num(f.wings) } : {}),
      ...(num(f.floors) !== undefined ? { floors: num(f.floors) } : {}),
      ...(num(f.homePass) !== undefined ? { homePass: num(f.homePass) } : {}),
    },
    contact: {
      contactName: f.contactName.trim(),
      contactPhone: f.contactPhone.trim(),
      designation: f.designation,
      ...(f.designationOther ? { designationOther: f.designationOther.trim() } : {}),
      ...(f.contactEmail ? { contactEmail: f.contactEmail.trim() } : {}),
    },
    permission: {
      ...(f.permissionStatus ? { permissionStatus: f.permissionStatus } : {}),
      ...(f.societyOffer ? { societyOffer: f.societyOffer } : {}),
      ...(isPayment && f.paymentType ? { paymentType: f.paymentType } : {}),
      ...(isPayment && num(f.amountPaid) !== undefined ? { amountPaid: num(f.amountPaid) } : {}),
      ...(isDemo && num(f.demoCount) !== undefined ? { demoCount: num(f.demoCount) } : {}),
      ...(f.permissionLetterUrl ? { documentUrl: f.permissionLetterUrl } : {}),
    },
    photos,
    remark: String(f.remark ?? '').trim(),
  }
}

/**
 * The PATCH /buildings/:id body for a society (PERMISSION building), from the
 * add payload. The update schema is strict: no placeId, and the letter lives
 * in `photos` (the server keeps permission.documentUrl in step), not in
 * `permission`. `photos` is the FULL set — the form's two plus `otherPhotos`
 * the building already had — because the server deletes whatever is missing.
 */
export function buildSocietyEditBody(payload, { otherPhotos = [] } = {}) {
  const { documentUrl, ...permission } = payload.permission ?? {}
  return {
    buildingName: payload.buildingName,
    formattedAddress: payload.formattedAddress,
    latitude: payload.latitude,
    longitude: payload.longitude,
    zoneId: payload.zoneId,
    details: payload.details,
    permission,
    contact: payload.contact,
    photos: [...(payload.photos ?? []), ...otherPhotos],
    remark: payload.remark,
  }
}

/** Required-field check, mirrored from the API's shape. */
export function societyFormErrors(f) {
  const fields = {}
  if (!String(f?.buildingName ?? '').trim()) fields.buildingName = 'Enter the building name'
  if (!String(f?.contactName ?? '').trim()) fields.contactName = 'Who did you meet?'
  if (!String(f?.contactPhone ?? '').trim()) fields.contactPhone = 'Contact number is required'
  if (!f?.permissionStatus) fields.permissionStatus = 'Choose the permission outcome'
  const blank = (v) => v == null || String(v).trim() === ''
  if (blank(f?.latitude) || blank(f?.longitude)) fields.location = 'Find the building on the map — search or move the pin'
  if (!String(f?.remark ?? '').trim()) fields.remark = 'Say what happened on this visit'
  return { fields, ok: Object.keys(fields).length === 0 }
}

// Societies are visited in India — show India time whatever the viewer's device says.
const IST = { timeZone: 'Asia/Kolkata' }
export const istDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const istDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        ...IST,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—'

/** "A Patil · Secretary" — the person met, with what they are at the society. */
export function personMetText(contact) {
  if (!contact?.contactName) return ''
  const role = contact.designation === 'OTHER' ? contact.designationOther : designationLabel(contact.designation)
  return role ? `${contact.contactName} · ${role}` : contact.contactName
}

// ── Admin approval (phase 2) ────────────────────────────────────────────────
// A society whose status becomes Accepted is sent to the admin automatically
// (approval PENDING). The admin approves it into a zone or rejects it with a
// reason; an approved society then shows up everywhere like any building.

export const APPROVAL_FILTER_OPTIONS = [
  { value: 'PENDING', label: 'Waiting for approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]
export const approvalLabel = (v) => APPROVAL_FILTER_OPTIONS.find((o) => o.value === v)?.label ?? v ?? ''

const APPROVAL_BADGE = {
  PENDING: 'bg-warn-tint text-warn',
  APPROVED: 'bg-ok-tint text-ok',
  REJECTED: 'bg-bad-tint text-bad',
}
export const approvalBadge = (v) => APPROVAL_BADGE[v] ?? 'bg-paper text-muted'

/**
 * The one chip a society shows in lists: the approval when there is one (it
 * says more than "Accepted"), else the permission status.
 */
export function societyChip({ permissionStatus, approval } = {}) {
  if (approval?.status) return { label: approvalLabel(approval.status), className: approvalBadge(approval.status) }
  return {
    label: permissionStatus ? permissionStatusLabel(permissionStatus) : 'No status',
    className: permissionStatusBadge(permissionStatus),
  }
}

/**
 * The box at the top of a society's page: { tone: 'warn'|'bad'|'ok', title,
 * detail, reason? }, or null when it was never sent for approval.
 */
export function approvalNotice(approval, zone) {
  if (!approval?.status) return null
  const by = approval.decidedBy?.name
  if (approval.status === 'PENDING') {
    // A re-submit keeps the last rejection's reason until approval — show it,
    // so the admin can check it was fixed.
    return {
      tone: 'warn',
      title: 'Waiting for admin approval',
      detail: `Since ${istDate(approval.submittedAt)}`,
      ...(approval.reason ? { reason: approval.reason, reasonLabel: 'Rejected before' } : {}),
    }
  }
  if (approval.status === 'REJECTED') {
    return {
      tone: 'bad',
      title: 'Rejected by admin',
      detail: [by, istDate(approval.decidedAt)].filter(Boolean).join(' · '),
      reason: approval.reason ?? '',
    }
  }
  if (approval.status === 'APPROVED') {
    const when = by ? `By ${by} on ${istDate(approval.decidedAt)}` : `On ${istDate(approval.decidedAt)}`
    return { tone: 'ok', title: 'Approved', detail: zone?.name ? `${when} · Zone ${zone.name}` : when }
  }
  return null
}

export const isApprovedSociety = (approval) => approval?.status === 'APPROVED'
/** Only an admin decides, and only a society that is waiting. */
export const canDecideApproval = (role, approval) => role === 'ADMIN' && approval?.status === 'PENDING'
/**
 * After approval the status stays Accepted for everyone (the API refuses any
 * other value) — a visit update is then a note only.
 */
export const canChangeSocietyStatus = (approval) => !isApprovedSociety(approval)
/** Edit details is the executive's own (phase 1) — and closed once approved. */
export const peCanEdit = (role, approval) => role === 'PERMISSION_EXECUTIVE' && !isApprovedSociety(approval)
/** A building that came from the permission executives (shown with its own look). */
export const isSociety = (building) => building?.source === 'PERMISSION'
