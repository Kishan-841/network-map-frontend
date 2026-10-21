import { connShort, connTone, expiryTone } from '@/lib/customer-filters'

const EXPIRY_TEXT = { bad: 'text-bad', warn: 'text-warn' }

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})
export const formatDate = (d) => (d ? dateOnly.format(new Date(d)) : '—')
export const formatMoney = (n) => (n == null ? '' : `₹${Number(n).toLocaleString('en-IN')}`)

/** Expiry date: red once expired, amber within 7 days. `now` comes from the caller to keep render pure. */
export function Expiry({ row, now }) {
  const tone = expiryTone(row.planExpiresAt, now)
  return (
    <span className={tone ? `font-medium ${EXPIRY_TEXT[tone]}` : ''}>
      {formatDate(row.planExpiresAt)}
      {tone === 'bad' && <span className="ml-1 text-xs">(expired)</span>}
    </span>
  )
}

/** Plan name; the amount underneath only when it is above zero (₹0 means "not recorded"). */
export function PlanCell({ row }) {
  const amount = Number(row.planAmount) > 0 ? row.planAmount : null
  if (!row.planName && amount == null) return '—'
  return (
    <span>
      {row.planName ?? '—'}
      {amount != null && <span className="block text-xs text-muted">{formatMoney(amount)}</span>}
    </span>
  )
}

const DOT = { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn', muted: 'bg-faint' }
const TEXT = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', muted: 'text-muted' }

/**
 * One line: dot + word + muted short age ("Online · 18m"). The word is always shown, so colour is
 * never the only signal. `title` carries the long form. `state` empty = never checked.
 */
export function ConnectionCell({ state, lastSeen, checkedAt, now, title, className = '' }) {
  const tone = connTone({ connState: state })
  const { word, note } = connShort({ state, lastSeen, checkedAt }, now)
  return (
    <span title={title} className={`inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium ${TEXT[tone]} ${className}`}>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} />
      {word}
      {note && <span className="font-normal text-muted">· {note}</span>}
    </span>
  )
}
