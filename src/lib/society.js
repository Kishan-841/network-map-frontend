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

const KIND_LABEL = { ADDED: 'Added', VISIT: 'Visit', EDIT: 'Edit' }
/** A history row's kind (PermissionVisit.kind) in words. */
export const visitKindLabel = (k) => KIND_LABEL[k] ?? k ?? ''

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
