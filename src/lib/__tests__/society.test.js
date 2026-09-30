import { describe, it, expect } from 'vitest'
import { buildSocietyPayload, societyFormErrors, PERMISSION_STATUS_OPTIONS } from '@/lib/society'

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
  it('flags missing society name / contact / zone / status', () => {
    const { fields, ok } = societyFormErrors({ ...good, buildingName: '', contactPhone: '', zoneId: '', permissionStatus: '' })
    expect(ok).toBe(false)
    expect(fields.buildingName).toBeTruthy()
    expect(fields.contactPhone).toBeTruthy()
    expect(fields.zoneId).toBeTruthy()
    expect(fields.permissionStatus).toBeTruthy()
  })
})
