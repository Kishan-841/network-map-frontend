import { describe, it, expect } from 'vitest'
import {
  buildSocietyPayload,
  buildSocietyEditBody,
  societyFormErrors,
  photosToForm,
  visitKindLabel,
  changeLabels,
  statusChangeText,
  permissionStatusBadge,
  PERMISSION_STATUS_OPTIONS,
  istDate,
  istDateTime,
  personMetText,
} from '@/lib/society'

const good = {
  buildingName: 'Green Society', formattedAddress: 'Baner', placeId: 'p1',
  latitude: 18.5, longitude: 73.8, zoneId: 'z1',
  wings: '2', floors: '7', homePass: '120',
  contactName: 'A Patil', contactPhone: '9876543210', designation: 'SECRETARY', contactEmail: '',
  permissionStatus: 'ACCEPTED', societyOffer: 'PAYMENT', paymentType: 'RECURRING', amountPaid: '5000', demoCount: '',
  permissionLetterUrl: 'https://r2/x.jpg', entrancePhotoUrl: '',
}

describe('society helpers', () => {
  it('has the three permission statuses', () => {
    expect(PERMISSION_STATUS_OPTIONS.map((o) => o.value)).toEqual(['ACCEPTED', 'FOLLOW_UP', 'DENIED'])
  })
  it('builds a POST /buildings payload with details/contact/permission/photos', () => {
    const p = buildSocietyPayload(good)
    expect(p).toMatchObject({
      buildingName: 'Green Society', zoneId: 'z1', latitude: 18.5, longitude: 73.8,
      details: { wings: 2, floors: 7, homePass: 120 },
      contact: { contactName: 'A Patil', contactPhone: '9876543210', designation: 'SECRETARY' },
      permission: { permissionStatus: 'ACCEPTED', societyOffer: 'PAYMENT', paymentType: 'RECURRING', amountPaid: 5000 },
    })
    expect(p.photos).toContainEqual({ type: 'PERMISSION_LETTER', url: 'https://r2/x.jpg' })
  })
  it('drops the demo count when the offer is PAYMENT', () => {
    expect(buildSocietyPayload(good).permission.demoCount).toBeUndefined()
  })
  it('keeps the demo count and drops payment fields when the offer is DEMO', () => {
    const p = buildSocietyPayload({ ...good, societyOffer: 'DEMO', demoCount: '3' })
    expect(p.permission.demoCount).toBe(3)
    expect(p.permission.paymentType).toBeUndefined()
  })
  it('flags missing society name / contact / status (zone is not required)', () => {
    const { fields, ok } = societyFormErrors({ ...good, buildingName: '', contactPhone: '', zoneId: '', permissionStatus: '' })
    expect(ok).toBe(false)
    expect(fields.buildingName).toBeTruthy()
    expect(fields.contactPhone).toBeTruthy()
    expect(fields.zoneId).toBeUndefined()
    expect(fields.permissionStatus).toBeTruthy()
  })
})

describe('society remark (every add, visit and edit carries one)', () => {
  it('sends the trimmed remark with the add payload', () => {
    expect(buildSocietyPayload({ ...good, remark: '  Met the secretary  ' }).remark).toBe('Met the secretary')
  })
  it('requires a pin on the map (the API refuses a building without coordinates)', () => {
    expect(societyFormErrors({ ...good, remark: 'x', latitude: '', longitude: '' }).fields.location).toBeTruthy()
    expect(societyFormErrors({ ...good, remark: 'x', latitude: '19.8', longitude: '75.3' }).fields.location).toBeUndefined()
  })
  it('requires a remark', () => {
    expect(societyFormErrors({ ...good, remark: '   ' }).fields.remark).toBeTruthy()
    expect(societyFormErrors({ ...good, remark: 'Met the secretary' }).ok).toBe(true)
  })
})

describe('buildSocietyEditBody (PATCH /buildings/:id on a PERMISSION building)', () => {
  const payload = buildSocietyPayload({ ...good, entrancePhotoUrl: 'https://r2/e.jpg', remark: 'Fixed the phone' })
  it('keeps contact, the remark and the strict-schema fields; drops placeId and permission.documentUrl', () => {
    const body = buildSocietyEditBody(payload)
    expect(body.placeId).toBeUndefined()
    expect(body.permission.documentUrl).toBeUndefined()
    expect(body.permission.permissionStatus).toBe('ACCEPTED')
    expect(body.contact).toMatchObject({ contactName: 'A Patil', designation: 'SECRETARY' })
    expect(body.remark).toBe('Fixed the phone')
  })
  it('sends the FULL photo set: the form photos plus every other photo the building already had', () => {
    const others = [{ type: 'ADDITIONAL', url: 'https://r2/a.jpg' }]
    const body = buildSocietyEditBody(payload, { otherPhotos: others })
    expect(body.photos).toEqual([
      { type: 'ENTRANCE', url: 'https://r2/e.jpg' },
      { type: 'PERMISSION_LETTER', url: 'https://r2/x.jpg' },
      { type: 'ADDITIONAL', url: 'https://r2/a.jpg' },
    ])
  })
  it('sends an empty photo set when every photo was removed', () => {
    expect(buildSocietyEditBody({ ...payload, photos: [] }).photos).toEqual([])
  })
})

describe('photosToForm', () => {
  it('splits a stored photo set into the form fields and the rest', () => {
    const r = photosToForm([
      { id: '1', type: 'ENTRANCE', url: 'e' },
      { id: '2', type: 'PERMISSION_LETTER', url: 'l' },
      { id: '3', type: 'ADDITIONAL', url: 'a' },
    ])
    expect(r).toEqual({ entrancePhotoUrl: 'e', permissionLetterUrl: 'l', otherPhotos: [{ type: 'ADDITIONAL', url: 'a' }] })
  })
  it('copes with no photos', () => {
    expect(photosToForm(undefined)).toEqual({ entrancePhotoUrl: '', permissionLetterUrl: '', otherPhotos: [] })
  })
})

describe('history labels', () => {
  it('labels the kinds', () => {
    expect(visitKindLabel('ADDED')).toBe('Added')
    expect(visitKindLabel('VISIT')).toBe('Visit')
    expect(visitKindLabel('EDIT')).toBe('Edit')
  })
  it('labels the changed-field keys, passing unknown ones through', () => {
    expect(changeLabels(['contact', 'offer', 'photos', 'zzz'])).toEqual(['Person met', 'Offer', 'Photos', 'zzz'])
  })
  it('describes a status change', () => {
    expect(statusChangeText('FOLLOW_UP', 'ACCEPTED')).toBe('Follow up → Accepted')
    expect(statusChangeText(null, 'ACCEPTED')).toBe('Accepted')
    expect(statusChangeText(null, null)).toBe('')
  })
  it('gives every status a badge class', () => {
    expect(permissionStatusBadge('ACCEPTED')).toContain('ok')
    expect(permissionStatusBadge('DENIED')).toContain('bad')
    expect(permissionStatusBadge(null)).toBeTruthy()
  })
})

describe('display helpers', () => {
  it('shows dates and times in India time whatever the device zone', () => {
    // 20:00 UTC is 01:30 the next day in IST.
    expect(istDate('2026-10-07T20:00:00Z')).toMatch(/8 Oct 2026/)
    expect(istDateTime('2026-10-07T20:00:00Z')).toMatch(/8 Oct 2026.*1:30/i)
    expect(istDate(null)).toBe('—')
  })
  it('names the person met with their designation', () => {
    expect(personMetText({ contactName: 'A Patil', designation: 'SECRETARY' })).toBe('A Patil · Secretary')
    expect(personMetText({ contactName: 'B', designation: 'OTHER', designationOther: 'Caretaker' })).toBe('B · Caretaker')
    expect(personMetText(null)).toBe('')
  })
})
