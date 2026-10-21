// Pure helpers of the customer page (spec 2026-10-21-customer-detail): alert chips, plan time and
// progress, quick-action links, the same-PON line. No React in here, so it can be tested.

import { expiryTone } from './customer-filters'
import { isOltDown } from './connection'

const DAY = 86400000
const IST_OFFSET = 330 * 60000

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})
const fmtDate = (d) => dateOnly.format(new Date(d))
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const toMs = (d) => (d == null || d === '' ? NaN : new Date(d).getTime())

/** Calendar day number in India (so "4 days left" counts dates, not 24 h slices). */
const istDay = (ms) => Math.floor((ms + IST_OFFSET) / DAY)

/** States that say something about the customer; pending/unavailable do not. */
const KNOWN = new Set(['online', 'offline', 'not_seen', 'not_linked', 'no_username'])

/**
 * The connection the page reasons about: the live answer when it says something, else the stored
 * snapshot on the customer row (connState, connOlt…). null when neither is known.
 */
export function effectiveConnection(customer, connection) {
  if (connection && KNOWN.has(connection.state)) {
    return {
      live: true,
      state: connection.state,
      oltReachable: connection.oltReachable,
      weak: Boolean(connection.weak || (connection.state === 'online' && connection.signalDropped)),
      best: connection.best ?? null,
    }
  }
  if (customer?.connState) {
    return {
      live: false,
      state: customer.connState,
      oltReachable: customer.oltReachable,
      weak: Boolean(customer.connWeak),
      best: {
        lastSeen: customer.connLastSeen ?? null,
        olt: customer.connOlt ?? null,
        pon: customer.connPon ?? null,
        onu: customer.connOnu ?? null,
        rxDbm: customer.connRxDbm ?? null,
        rxQuality: customer.connRxQuality ?? null,
      },
    }
  }
  return null
}

/** PON number out of the sheet's text ("6", "PON 6", "0/1/6" -> 6); null when there is none. */
export function sheetPon(value) {
  if (value == null) return null
  const m = String(value).match(/(\d+)\D*$/)
  return m ? Number(m[1]) : null
}

/**
 * Plan time as { expired, daysLeft, daysAgo } in India calendar days; null without a valid expiry.
 * Expired = the expiry moment has passed.
 */
function planTime(expiresAt, now) {
  const exp = toMs(expiresAt)
  const at = toMs(now)
  if (!Number.isFinite(exp) || !Number.isFinite(at)) return null
  if (exp < at) return { expired: true, daysAgo: Math.max(0, istDay(at) - istDay(exp)), daysLeft: 0 }
  return { expired: false, daysAgo: 0, daysLeft: Math.max(0, istDay(exp) - istDay(at)) }
}

const expiredText = (daysAgo) => (daysAgo === 0 ? 'Expired today' : `Expired ${plural(daysAgo, 'day')} ago`)

/**
 * The header's plan fact: { text, tone } — "Expires in 4 days" / "Expires 12 Sept 2027" (> 30 days)
 * / "Expired 9 days ago". tone is expiryTone's ('bad' | 'warn' | null). null without an expiry.
 */
export function planTimeText(expiresAt, now) {
  const t = planTime(expiresAt, now)
  if (!t) return null
  const tone = expiryTone(expiresAt, now)
  if (t.expired) return { text: expiredText(t.daysAgo), tone }
  if (t.daysLeft > 30) return { text: `Expires ${fmtDate(expiresAt)}`, tone }
  if (t.daysLeft === 0) return { text: 'Expires today', tone }
  if (t.daysLeft === 1) return { text: 'Expires tomorrow', tone }
  return { text: `Expires in ${t.daysLeft} days`, tone }
}

/**
 * The Plan card's bar: { pct, daysLeft, expired, label, tone }. pct is 0–100 of the way from
 * activation to expiry (null when the activation date is missing or not before expiry). label:
 * "4 days left" / "Expired 9 days ago" / "Expires 12 Sept 2027" (> 30 days). null without an expiry.
 */
export function planProgress(activatedAt, expiresAt, now) {
  const t = planTime(expiresAt, now)
  if (!t) return null
  const start = toMs(activatedAt)
  const end = toMs(expiresAt)
  const at = toMs(now)
  let pct = null
  if (t.expired) pct = 100
  else if (Number.isFinite(start) && start < end) pct = Math.min(100, Math.max(0, ((at - start) / (end - start)) * 100))
  let label
  if (t.expired) label = expiredText(t.daysAgo)
  else if (t.daysLeft > 30) label = `Expires ${fmtDate(expiresAt)}`
  else if (t.daysLeft === 0) label = 'Last day'
  else label = `${plural(t.daysLeft, 'day')} left`
  return { pct, daysLeft: t.daysLeft, expired: t.expired, label, tone: expiryTone(expiresAt, now) }
}

/**
 * Alert chips under the header, only the true ones: [{ id, tone: 'bad'|'warn'|'muted', text }].
 * `connection` is the live answer (or null); the customer's stored snapshot stands in until it comes.
 */
export function customerAlerts(customer, connection, now) {
  if (!customer) return []
  const alerts = []
  const add = (id, tone, text) => alerts.push({ id, tone, text })

  const plan = planTime(customer.planExpiresAt, now)
  const planTone = expiryTone(customer.planExpiresAt, now)
  if (plan?.expired) add('plan-expired', 'bad', `Plan ${expiredText(plan.daysAgo).toLowerCase()}`)
  else if (plan && planTone === 'warn') {
    const when = plan.daysLeft === 0 ? 'today' : plan.daysLeft === 1 ? 'tomorrow' : `in ${plan.daysLeft} days`
    add('plan-expiring', 'warn', `Plan expires ${when}`)
  }

  if (!customer.username || !String(customer.username).trim()) {
    add('no-username', 'muted', "No username (status can't be checked)")
    return alerts
  }

  const c = effectiveConnection(customer, connection)
  if (c?.state === 'offline') add('offline', 'bad', 'Offline')
  if (c && isOltDown(c)) add('olt-down', 'muted', 'OLT not reachable')
  else if (c?.state === 'not_seen') {
    const seen = c.best?.lastSeen
    add('not-seen', 'warn', seen ? `Box not seen since ${fmtDate(seen)}` : 'Box not seen')
  }
  if (c?.weak) add('weak', 'warn', 'Weak signal')

  const sheet = sheetPon(customer.ponNumber)
  const live = c?.best?.pon ?? customer.connPon
  if (sheet != null && live != null && Number(live) !== sheet) {
    add('pon-mismatch', 'warn', `Sheet says PON ${sheet}, live shows PON ${live}`)
  }
  return alerts
}

/** "-22.1 dBm" against the ONU's usual level: { text: "3.0 dB below usual", tone } or null. */
export function signalVsUsual(onu) {
  if (!onu || onu.rxDbm == null || onu.baselineRxDbm == null) return null
  const diff = Number(onu.baselineRxDbm) - Number(onu.rxDbm)
  if (!Number.isFinite(diff)) return null
  if (Math.abs(diff) < 0.5) return { text: 'Usual level', tone: 'muted' }
  const db = Math.abs(diff).toFixed(1)
  if (diff > 0) return { text: `${db} dB below usual`, tone: diff >= 3 - 1e-9 ? 'warn' : 'muted' }
  return { text: `${db} dB above usual`, tone: 'muted' }
}

/** WhatsApp chat link for a 10-digit Indian mobile (spaces/dashes ignored); null otherwise. */
export function whatsappUrl(mobile) {
  if (mobile == null) return null
  const digits = String(mobile).replace(/[\s-]/g, '')
  return /^\d{10}$/.test(digits) ? `https://wa.me/91${digits}` : null
}

/** Phone link; null without a number. */
export function telUrl(mobile) {
  const v = mobile == null ? '' : String(mobile).replace(/[\s-]/g, '')
  return /^\+?\d{6,15}$/.test(v) ? `tel:${v}` : null
}

const coord = (v) => (v == null || v === '' ? NaN : Number(v))

/** Google Maps directions to a point; null when either coordinate is missing. */
export function directionsUrl(lat, lng) {
  const a = coord(lat)
  const b = coord(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${a},${b}`
}

const PON_PARTS = [
  ['online', 'online'],
  ['notSeen', 'not seen'],
  ['offline', 'offline'],
  ['oltDown', 'OLT not reachable'],
]

/**
 * "Same PON (OLT · PON 3): 31 customers · 29 online · 1 not seen" — zero parts hidden. When every
 * customer on it is on an unreachable OLT: "…: 31 customers · OLT not reachable". null when unknown.
 */
export function samePonLine(samePon) {
  if (!samePon || samePon.pon == null || !(samePon.total > 0)) return null
  const head = `Same PON (${samePon.olt ? `${samePon.olt} · ` : ''}PON ${samePon.pon}): ${plural(samePon.total, 'customer')}`
  if (samePon.oltDown === samePon.total) return `${head} · OLT not reachable`
  const parts = PON_PARTS.filter(([k]) => samePon[k] > 0).map(([k, word]) => `${samePon[k]} ${word}`)
  return [head, ...parts].join(' · ')
}
