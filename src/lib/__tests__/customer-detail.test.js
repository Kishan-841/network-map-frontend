import { describe, it, expect } from 'vitest'
import {
  customerAlerts,
  planProgress,
  planTimeText,
  whatsappUrl,
  telUrl,
  directionsUrl,
  samePonLine,
  sheetPon,
  signalVsUsual,
  effectiveConnection,
} from '@/lib/customer-detail'

// 21 Oct 2026, 10:00 IST
const NOW = Date.parse('2026-10-21T04:30:00Z')
// Expiry as the sheet stores it: 23:59:59 IST on the given date.
const endOf = (ymd) => `${ymd}T18:29:59.000Z`

const base = { username: 'abc123', ponNumber: null, planExpiresAt: null, connState: null }
const ids = (alerts) => alerts.map((a) => a.id)
const live = (over = {}) => ({
  state: 'online',
  oltReachable: true,
  weak: false,
  signalDropped: false,
  onus: [],
  best: { olt: 'OLT-1', pon: 3, rxDbm: -19.2, rxQuality: 'good', lastSeen: '2026-10-21T04:00:00Z' },
  ...over,
})

describe('planTimeText', () => {
  it('counts India calendar days to the expiry', () => {
    expect(planTimeText(endOf('2026-10-25'), NOW)).toEqual({ text: 'Expires in 4 days', tone: 'warn' })
    expect(planTimeText(endOf('2026-10-22'), NOW).text).toBe('Expires tomorrow')
    expect(planTimeText(endOf('2026-10-21'), NOW).text).toBe('Expires today')
  })
  it('shows the date past 30 days', () => {
    expect(planTimeText(endOf('2027-09-12'), NOW)).toEqual({ text: 'Expires 12 Sept 2027', tone: null })
    expect(planTimeText(endOf('2026-11-20'), NOW).text).toBe('Expires in 30 days')
  })
  it('says how long ago it expired', () => {
    expect(planTimeText(endOf('2026-10-12'), NOW)).toEqual({ text: 'Expired 9 days ago', tone: 'bad' })
    expect(planTimeText(endOf('2026-10-20'), NOW).text).toBe('Expired 1 day ago')
  })
  it('is null without a usable date', () => {
    expect(planTimeText(null, NOW)).toBeNull()
    expect(planTimeText('nope', NOW)).toBeNull()
  })
})

describe('planProgress', () => {
  it('measures activation -> expiry', () => {
    const p = planProgress('2026-10-01T04:30:00Z', '2026-10-31T04:30:00Z', NOW)
    expect(p.pct).toBeCloseTo((20 / 30) * 100, 5)
    expect(p).toMatchObject({ daysLeft: 10, expired: false, label: '10 days left', tone: null })
  })
  it('labels the last days and the expired state', () => {
    expect(planProgress('2026-07-25T00:00:00Z', endOf('2026-10-25'), NOW)).toMatchObject({ label: '4 days left', tone: 'warn' })
    expect(planProgress('2026-07-25T00:00:00Z', endOf('2026-10-22'), NOW).label).toBe('1 day left')
    expect(planProgress('2026-07-25T00:00:00Z', endOf('2026-10-21'), NOW).label).toBe('Last day')
    expect(planProgress('2026-07-12T00:00:00Z', endOf('2026-10-12'), NOW)).toMatchObject({
      pct: 100,
      expired: true,
      label: 'Expired 9 days ago',
      tone: 'bad',
    })
  })
  it('keeps counting days when more than 30 remain', () => {
    expect(planProgress('2026-09-12T00:00:00Z', endOf('2027-09-12'), NOW).label).toBe('326 days left')
  })
  it('clamps and tolerates a missing activation', () => {
    expect(planProgress('2026-11-01T00:00:00Z', endOf('2026-12-01'), NOW).pct).toBe(0)
    expect(planProgress(null, endOf('2026-12-01'), NOW).pct).toBeNull()
    expect(planProgress(null, null, NOW)).toBeNull()
  })
})

describe('customerAlerts', () => {
  it('is empty for a healthy customer', () => {
    expect(customerAlerts({ ...base, planExpiresAt: endOf('2027-01-01') }, live(), NOW)).toEqual([])
  })
  it('leaves plan expiry to the facts row', () => {
    expect(customerAlerts({ ...base, planExpiresAt: endOf('2026-10-12') }, live(), NOW)).toEqual([])
    expect(customerAlerts({ ...base, planExpiresAt: endOf('2026-10-25') }, live(), NOW)).toEqual([])
  })
  it('flags weak signal from weak or a 3 dB drop while online', () => {
    expect(ids(customerAlerts(base, live({ weak: true }), NOW))).toEqual(['weak'])
    expect(ids(customerAlerts(base, live({ signalDropped: true }), NOW))).toEqual(['weak'])
    expect(ids(customerAlerts(base, live({ state: 'offline', signalDropped: true }), NOW))).toEqual([])
  })
  it('does not restate offline, OLT not reachable or a dated not-seen', () => {
    const notSeen = live({ state: 'not_seen', best: { lastSeen: '2026-10-05T06:00:00Z', pon: 3 } })
    expect(customerAlerts(base, live({ state: 'offline' }), NOW)).toEqual([])
    expect(customerAlerts(base, notSeen, NOW)).toEqual([])
    expect(customerAlerts(base, live({ state: 'not_seen', best: { pon: 3 } }), NOW)).toEqual([])
  })
  it('adds the last-seen date only when OLT-down hides it from the facts row', () => {
    const notSeen = live({ state: 'not_seen', oltReachable: false, best: { lastSeen: '2026-10-05T06:00:00Z', pon: 3 } })
    expect(customerAlerts(base, notSeen, NOW)).toEqual([
      { id: 'not-seen', tone: 'warn', text: 'Box not seen since 5 Oct 2026' },
    ])
  })
  it('flags a sheet PON that differs from the live one', () => {
    expect(customerAlerts({ ...base, ponNumber: '6' }, live(), NOW)).toEqual([
      { id: 'pon-mismatch', tone: 'warn', text: 'Sheet says PON 6, live shows PON 3' },
    ])
    expect(customerAlerts({ ...base, ponNumber: '3' }, live(), NOW)).toEqual([])
    expect(customerAlerts({ ...base, ponNumber: null }, live(), NOW)).toEqual([])
  })
  it('falls back to the stored snapshot until the live answer comes', () => {
    const stored = { ...base, ponNumber: '6', connState: 'offline', connPon: 3, connWeak: false }
    expect(ids(customerAlerts(stored, null, NOW))).toEqual(['pon-mismatch'])
    expect(ids(customerAlerts(stored, { state: 'pending', onus: [], best: null }, NOW))).toEqual(['pon-mismatch'])
    expect(ids(customerAlerts({ ...stored, connState: 'online', connWeak: true }, null, NOW))).toEqual(['weak', 'pon-mismatch'])
  })
  it('flags a missing username and nothing about the connection', () => {
    expect(customerAlerts({ ...base, username: '  ' }, { state: 'no_username' }, NOW)).toEqual([
      { id: 'no-username', tone: 'muted', text: "No username (status can't be checked)" },
    ])
  })
  it('is empty without a customer', () => {
    expect(customerAlerts(null, null, NOW)).toEqual([])
  })
})

describe('effectiveConnection', () => {
  it('prefers a live answer that says something', () => {
    expect(effectiveConnection({ connState: 'offline' }, live()).live).toBe(true)
    expect(effectiveConnection({ connState: 'offline' }, { state: 'unavailable' })).toMatchObject({ live: false, state: 'offline' })
    expect(effectiveConnection({}, null)).toBeNull()
  })
})

describe('sheetPon', () => {
  it('reads the last number', () => {
    expect(sheetPon('6')).toBe(6)
    expect(sheetPon('PON 6')).toBe(6)
    expect(sheetPon('0/1/6')).toBe(6)
    expect(sheetPon('')).toBeNull()
    expect(sheetPon(null)).toBeNull()
  })
})

describe('signalVsUsual', () => {
  it('compares with the baseline', () => {
    expect(signalVsUsual({ rxDbm: -22.1, baselineRxDbm: -19.1 })).toEqual({ text: '3.0 dB below usual', tone: 'warn' })
    expect(signalVsUsual({ rxDbm: -20.1, baselineRxDbm: -19.1 })).toEqual({ text: '1.0 dB below usual', tone: 'muted' })
    expect(signalVsUsual({ rxDbm: -19.2, baselineRxDbm: -19.1 })).toEqual({ text: 'Usual level', tone: 'muted' })
    expect(signalVsUsual({ rxDbm: -17, baselineRxDbm: -19 }).text).toBe('2.0 dB above usual')
    expect(signalVsUsual({ rxDbm: -17 })).toBeNull()
  })
})

describe('links', () => {
  it('whatsappUrl normalises Indian mobiles', () => {
    expect(whatsappUrl('9821301428')).toBe('https://wa.me/919821301428')
    expect(whatsappUrl('98213 01428')).toBe('https://wa.me/919821301428')
    expect(whatsappUrl('919821301428')).toBe('https://wa.me/919821301428')
    expect(whatsappUrl('+91 98213-01428')).toBe('https://wa.me/919821301428')
    expect(whatsappUrl('09821301428')).toBe('https://wa.me/919821301428')
    expect(whatsappUrl('0224455 / 98213 01428')).toBe('https://wa.me/919821301428')
    expect(whatsappUrl('9821301428, 9000000000')).toBe('https://wa.me/919821301428')
    expect(whatsappUrl('12345')).toBeNull()
    expect(whatsappUrl('02402345678')).toBeNull()
    expect(whatsappUrl('5821301428')).toBeNull()
    expect(whatsappUrl(null)).toBeNull()
  })
  it('telUrl', () => {
    expect(telUrl('9821301428')).toBe('tel:9821301428')
    expect(telUrl('+91 98213 01428')).toBe('tel:9821301428')
    expect(telUrl('9821301428 / 9000000000')).toBe('tel:9821301428')
    expect(telUrl('02402345678')).toBe('tel:02402345678')
    expect(telUrl('5821301428')).toBe('tel:5821301428')
    expect(telUrl('')).toBeNull()
    expect(telUrl(null)).toBeNull()
  })
  it('directionsUrl needs both coordinates', () => {
    expect(directionsUrl(18.62, 73.77)).toBe('https://www.google.com/maps/dir/?api=1&destination=18.62,73.77')
    expect(directionsUrl('18.62', '73.77')).toBe('https://www.google.com/maps/dir/?api=1&destination=18.62,73.77')
    expect(directionsUrl(null, 73.77)).toBeNull()
    expect(directionsUrl(18.62, '')).toBeNull()
  })
})

describe('samePonLine', () => {
  it('hides zero parts', () => {
    expect(samePonLine({ olt: 'OLT', pon: 3, total: 31, online: 29, offline: 0, notSeen: 1, oltDown: 0 })).toBe(
      'Same PON (OLT · PON 3): 31 customers · 29 online · 1 not seen',
    )
    expect(samePonLine({ olt: 'OLT', pon: 3, total: 4, online: 1, offline: 2, notSeen: 1, oltDown: 0 })).toBe(
      'Same PON (OLT · PON 3): 4 customers · 1 online · 1 not seen · 2 offline',
    )
  })
  it('reads OLT not reachable when the whole PON is on a down OLT', () => {
    expect(samePonLine({ olt: 'OLT', pon: 3, total: 31, online: 0, offline: 0, notSeen: 0, oltDown: 31 })).toBe(
      'Same PON (OLT · PON 3): 31 customers · OLT not reachable',
    )
  })
  it('singular and null cases', () => {
    expect(samePonLine({ olt: 'OLT', pon: 3, total: 1, online: 1, offline: 0, notSeen: 0, oltDown: 0 })).toBe(
      'Same PON (OLT · PON 3): 1 customer · 1 online',
    )
    expect(samePonLine(null)).toBeNull()
    expect(samePonLine({ olt: 'OLT', pon: null, total: 3 })).toBeNull()
  })
})
