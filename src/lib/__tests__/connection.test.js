import { describe, it, expect } from 'vitest'
import {
  connectionLabel,
  connectionTone,
  droppedText,
  formatOnuSignal,
  formatSignal,
  summaryLine,
  worstTone,
} from '../connection'

const onu = (o = {}) => ({ rxDbm: -15.8, rxQuality: 'good', baselineRxDbm: -12.1, lastSeen: '2026-10-05T10:00:00Z', ...o })

describe('connectionLabel', () => {
  it('labels every state', () => {
    expect(connectionLabel({ state: 'online' })).toBe('Online')
    expect(connectionLabel({ state: 'offline' })).toBe('Offline')
    expect(connectionLabel({ state: 'not_linked' })).toBe('Not linked to any device')
    expect(connectionLabel({ state: 'no_username' })).toBe('No username')
    expect(connectionLabel({ state: 'unavailable' })).toBe('Status unavailable')
    expect(connectionLabel({ state: 'pending' })).toBe('Not checked yet')
  })
  it('not_seen uses best.lastSeen in IST', () => {
    expect(connectionLabel({ state: 'not_seen', best: onu() })).toBe('Not seen since 5 Oct 2026')
    // 20:00 UTC on 4 Oct is already 5 Oct in IST
    expect(connectionLabel({ state: 'not_seen', best: onu({ lastSeen: '2026-10-04T20:00:00Z' }) })).toBe(
      'Not seen since 5 Oct 2026',
    )
  })
  it('not_seen without a date degrades', () => {
    expect(connectionLabel({ state: 'not_seen', best: null })).toBe('Not seen')
  })
  it('returns null for no connection', () => {
    expect(connectionLabel(null)).toBeNull()
  })
})

describe('connectionTone', () => {
  it('maps states to tones', () => {
    expect(connectionTone({ state: 'online' })).toBe('ok')
    expect(connectionTone({ state: 'offline' })).toBe('bad')
    expect(connectionTone({ state: 'not_seen' })).toBe('warn')
    expect(connectionTone({ state: 'not_linked' })).toBe('muted')
    expect(connectionTone({ state: 'pending' })).toBe('muted')
  })
})

describe('formatSignal', () => {
  it('formats dBm with capitalised quality', () => {
    expect(formatSignal({ best: onu() })).toBe('-15.8 dBm · Good')
    expect(formatOnuSignal(onu({ rxQuality: 'weak' }))).toBe('-15.8 dBm · Weak')
  })
  it('omits quality when null, null when no rx', () => {
    expect(formatSignal({ best: onu({ rxQuality: null }) })).toBe('-15.8 dBm')
    expect(formatSignal({ best: onu({ rxDbm: null }) })).toBeNull()
    expect(formatSignal({ best: null })).toBeNull()
    expect(formatSignal(null)).toBeNull()
  })
  it('rounds to one decimal', () => {
    expect(formatSignal({ best: onu({ rxDbm: -15.84, rxQuality: null }) })).toBe('-15.8 dBm')
  })
})

describe('droppedText', () => {
  const live = (o = {}) => onu({ status: 'online', stale: false, ...o })
  const c = { state: 'online', best: live() }
  it('shows when online and the ONU dropped 3+ dB', () => {
    expect(droppedText(c)).toBe('Signal dropped from -12.1 dBm')
  })
  it('hidden when the connection is not online', () => {
    expect(droppedText({ ...c, state: 'offline' })).toBeNull()
  })
  it('decides per ONU: only the dropped one shows', () => {
    const dropped = live({ rxDbm: -20, baselineRxDbm: -12 })
    const fine = live({ rxDbm: -13, baselineRxDbm: -12 })
    const conn = { state: 'online', onus: [dropped, fine], best: fine }
    expect(droppedText(conn, dropped)).toBe('Signal dropped from -12.0 dBm')
    expect(droppedText(conn, fine)).toBeNull()
  })
  it('exact -3 boundary counts as dropped, just above does not', () => {
    expect(droppedText(c, live({ rxDbm: -15.1, baselineRxDbm: -12.1 }))).not.toBeNull()
    expect(droppedText(c, live({ rxDbm: -15.0, baselineRxDbm: -12.1 }))).toBeNull()
  })
  it('hidden for an offline or stale ONU', () => {
    expect(droppedText(c, live({ status: 'offline' }))).toBeNull()
    expect(droppedText(c, live({ stale: true }))).toBeNull()
  })
})

describe('summaryLine', () => {
  it('joins non-zero parts in order', () => {
    expect(summaryLine({ online: 41, offline: 3, weak: 2, notSeen: 0, notLinked: 5, noUsername: 0, unavailable: 0 })).toBe(
      '41 online · 3 offline · 2 weak signal · 5 not linked',
    )
  })
  it('keeps the full order', () => {
    expect(summaryLine({ online: 1, offline: 1, weak: 1, notSeen: 1, notLinked: 1, noUsername: 1, unavailable: 1 })).toBe(
      '1 online · 1 offline · 1 weak signal · 1 not seen · 1 not linked · 1 no username · 1 unavailable',
    )
  })
  it('returns null when all zero or missing', () => {
    expect(summaryLine({ online: 0 })).toBeNull()
    expect(summaryLine(null)).toBeNull()
  })
})

describe('worstTone', () => {
  it('is bad when any customer is offline', () => {
    expect(worstTone({ online: 9, offline: 1 })).toBe('bad')
  })
  it('is warn when some are not seen and none offline', () => {
    expect(worstTone({ online: 9, notSeen: 2 })).toBe('warn')
  })
  it('is ok when only online (others are not faults)', () => {
    expect(worstTone({ online: 3, notLinked: 4, weak: 1 })).toBe('ok')
  })
  it('is muted when nothing is online, offline or not seen, or counts are missing', () => {
    expect(worstTone({ notLinked: 4 })).toBe('muted')
    expect(worstTone(null)).toBe('muted')
  })
})

describe('pending', () => {
  it('summaryLine puts pending last with the reload hint', () => {
    expect(summaryLine({ online: 20, offline: 1, notLinked: 2, unavailable: 1, pending: 30 })).toBe(
      '20 online · 1 offline · 2 not linked · 1 unavailable · 30 not checked yet — reload in a minute',
    )
    expect(summaryLine({ online: 1, pending: 0 })).toBe('1 online')
  })
  it('pending never makes the dot bad or warn', () => {
    expect(worstTone({ pending: 30 })).toBe('muted')
    expect(worstTone({ online: 2, pending: 30 })).toBe('ok')
  })
})
