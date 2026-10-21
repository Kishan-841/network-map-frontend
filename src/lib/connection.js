// Copy and formatting for a customer's live OLT connection (pure, no React).

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})

const LABELS = {
  online: 'Online',
  offline: 'Offline',
  not_linked: 'Not linked to any device',
  no_username: 'No username',
  unavailable: 'Status unavailable',
  pending: 'Not checked yet',
}

const TONES = { online: 'ok', offline: 'bad', not_seen: 'warn' }

export const OLT_DOWN_LABEL = 'OLT not reachable'

/** Not seen, but only because our OLT monitoring cannot reach the customer's OLT (oltReachable === false). */
export function isOltDown(c) {
  return c?.state === 'not_seen' && c?.oltReachable === false
}

/** Tooltip for an OLT-not-reachable status; `olt` may be empty. */
export function oltDownTitle(olt) {
  return `Our OLT monitoring can't reach ${olt || 'this OLT'} — this customer may be fine.`
}

/** The status word shown next to the dot. */
export function connectionLabel(c) {
  if (!c) return null
  if (isOltDown(c)) return OLT_DOWN_LABEL
  if (c.state === 'not_seen') {
    const seen = c.best?.lastSeen
    return seen ? `Not seen since ${dateOnly.format(new Date(seen))}` : 'Not seen'
  }
  return LABELS[c.state] ?? null
}

/** 'ok' | 'bad' | 'warn' | 'muted' — colour is never the only signal (the word is always shown). */
export function connectionTone(c) {
  return TONES[c?.state] ?? 'muted'
}

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** `-15.8 dBm · Good` for one ONU; null when it has no reading. */
export function formatOnuSignal(onu) {
  if (!onu || onu.rxDbm == null) return null
  const dbm = `${Number(onu.rxDbm).toFixed(1)} dBm`
  return onu.rxQuality ? `${dbm} · ${capitalise(onu.rxQuality)}` : dbm
}

/** Row-level signal: the connection's best ONU. */
export function formatSignal(c) {
  return formatOnuSignal(c?.best)
}

/**
 * "Signal dropped from -12.1 dBm" — decided per ONU: the connection is online, this ONU is
 * online and not stale, and rx <= baseline - 3 (1e-9 epsilon, like the backend).
 */
export function droppedText(c, onu = c?.best) {
  if (!c || c.state !== 'online' || !onu) return null
  if (onu.status !== 'online' || onu.stale) return null
  if (onu.rxDbm == null || onu.baselineRxDbm == null) return null
  if (!(onu.rxDbm <= onu.baselineRxDbm - 3 + 1e-9)) return null
  return `Signal dropped from ${Number(onu.baselineRxDbm).toFixed(1)} dBm`
}

const SUMMARY_PARTS = [
  ['online', 'online'],
  ['offline', 'offline'],
  ['weak', 'weak signal'],
  ['notSeen', 'not seen'],
  ['oltDown', 'OLT not reachable'],
  ['notLinked', 'not linked'],
  ['noUsername', 'no username'],
  ['unavailable', 'unavailable'],
  ['pending', 'not checked yet — reload in a minute'],
]

/** `41 online · 3 offline · 2 weak signal · 5 not linked`; zero parts hidden; null when empty. */
export function summaryLine(counts) {
  if (!counts) return null
  const parts = SUMMARY_PARTS.filter(([key]) => counts[key] > 0).map(([key, word]) => `${counts[key]} ${word}`)
  return parts.length ? parts.join(' · ') : null
}

/** Tone for a building's summary dot: offline -> bad, not seen -> warn, else online -> ok, else muted. */
export function worstTone(counts) {
  if (counts?.offline > 0) return 'bad'
  if (counts?.notSeen > 0 || counts?.oltDown > 0) return 'warn'
  if (counts?.online > 0) return 'ok'
  return 'muted'
}
