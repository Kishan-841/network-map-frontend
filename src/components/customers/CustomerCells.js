import { expiryTone } from '@/lib/customer-filters'

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

/** Plan name with its amount underneath. */
export function PlanCell({ row }) {
  if (!row.planName && row.planAmount == null) return '—'
  return (
    <span>
      {row.planName ?? '—'}
      {row.planAmount != null && <span className="block text-xs text-muted">{formatMoney(row.planAmount)}</span>}
    </span>
  )
}

/** Billing status chip. */
export function BillingChip({ status }) {
  return status ? <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-muted">{status}</span> : '—'
}
