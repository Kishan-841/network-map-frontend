/**
 * The society-permission capture (Permission Executive). Option lists in the
 * sales person's words, a payload builder that maps the flat form to the
 * POST /buildings body, and the required-field check. Kept pure and tested.
 */

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
  }
}

/** Required-field check, mirrored from the API's shape. */
export function societyFormErrors(f) {
  const fields = {}
  if (!String(f?.buildingName ?? '').trim()) fields.buildingName = 'Enter the society name'
  if (!String(f?.contactName ?? '').trim()) fields.contactName = 'Who did you meet?'
  if (!String(f?.contactPhone ?? '').trim()) fields.contactPhone = 'Contact number is required'
  if (!f?.permissionStatus) fields.permissionStatus = 'Choose the permission outcome'
  return { fields, ok: Object.keys(fields).length === 0 }
}
