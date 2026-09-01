'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { IconChevronDown, IconPlus } from '@/components/ui/icons'
import { EarningsChart, lastMonths, monthNames } from '@/components/earnings/EarningsChart'
import { LeadProgress } from '@/components/earnings/LeadProgress'

const rupees = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`

const PERIOD_LABEL = {
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  YEARLY: 'Yearly',
}

/** "2026-08" → "August 2026". Parsed as a date, not string-sliced. */
const monthLabel = (key) => monthNames(key).long

/**
 * Whether we have paid a month. Deliberately two words the partner already
 * uses, not a status code: "Awaiting payment" says who is waiting on whom.
 */
function PaidPill({ status }) {
  const paid = status === 'PAID'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        paid ? 'bg-ok-tint text-ok' : 'bg-warn-tint text-warn'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${paid ? 'bg-ok' : 'bg-warn'}`} />
      {paid ? 'Paid' : 'Awaiting payment'}
    </span>
  )
}

/**
 * One month, openable to show which customers made it up.
 *
 * The summary is what a partner checks; the breakdown is what they argue
 * with, so it is one tap away rather than on a separate screen.
 */
function MonthRow({ month }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-line/70 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-paper/60"
      >
        <IconChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
        {/* The month and its total share the top line; the pill drops beneath
            rather than competing for width with them. A phone cannot fit all
            three side by side without truncating the month name, and the
            month name is the one thing that must never be cut. */}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium">{monthLabel(month.month)}</span>
            <span className="shrink-0 text-base font-bold tabular-nums">
              {rupees(month.total)}
            </span>
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <PaidPill status={month.status} />
            <span className="text-xs font-normal text-muted">
              {month.count} {month.count === 1 ? 'customer' : 'customers'}
            </span>
          </span>
        </span>
      </button>

      {open && (
        <ul className="bg-paper/40 px-4 pb-3">
          {month.lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center gap-3 border-t border-line/50 py-2.5 first:border-t-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{line.customerName ?? 'Customer'}</span>
                <span className="block text-xs font-normal text-muted">
                  {line.speedMbps} Mbps · {PERIOD_LABEL[line.billingPeriod] ?? line.billingPeriod}
                </span>
              </span>
              {/* Only when this line disagrees with the month — repeating
                  "Awaiting" under an "Awaiting payment" header is noise. */}
              {line.status !== month.status && (
                <span
                  className={`shrink-0 text-xs font-normal ${
                    line.status === 'PAID' ? 'text-ok' : 'text-warn'
                  }`}
                >
                  {line.status === 'PAID' ? 'Paid' : 'Awaiting'}
                </span>
              )}
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {rupees(line.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The partner's home: what they have earned, month by month, and what we
 * still owe them (partner-network.md §6.1). This is the first thing they see
 * on opening the app, because it is the reason they use it.
 */
export default function PartnerEarningsPage() {
  const partner = usePartnerAuthStore((s) => s.partner)
  const [statement, setStatement] = useState(null)
  const [error, setError] = useState(null)
  const [month, setMonth] = useState('')
  const [paid, setPaid] = useState('')
  const [leads, setLeads] = useState(null)

  useEffect(() => {
    let cancelled = false
    partnerApi
      .get('/partner/earnings')
      .then((res) => !cancelled && setStatement(res.data.data))
      .catch((err) => !cancelled && setError(getPartnerApiError(err, 'Could not load your earnings')))
    return () => {
      cancelled = true
    }
  }, [])

  // Their leads, for the progress card. A failure here must not take the
  // earnings down with it — the money is the point of this page.
  useEffect(() => {
    let cancelled = false
    partnerApi
      .get('/partner/leads')
      .then((res) => !cancelled && setLeads(res.data.data))
      .catch(() => !cancelled && setLeads([]))
    return () => {
      cancelled = true
    }
  }, [])

  const months = useMemo(() => {
    const all = statement?.months ?? []
    return all.filter((m) => (!month || m.month === month) && (!paid || m.status === paid))
  }, [statement, month, paid])

  const firstName = partner?.name?.split(' ')[0]

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Your earnings</h1>
      <p className="mt-1 text-sm font-normal text-muted">
        {firstName ? `${firstName}, what` : 'What'} you have earned from customers who signed up.
      </p>

      {error && (
        <p className="mt-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error}
        </p>
      )}

      {/* The two numbers that matter, largest first: what is coming, and what
          has been earned in total. */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-card bg-card p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Awaiting payment</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-warn">
            {statement ? rupees(statement.outstanding) : '—'}
          </p>
        </div>
        <div className="rounded-card bg-card p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Earned in all</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums">
            {statement ? rupees(statement.total) : '—'}
          </p>
        </div>
      </div>

      {/* Two columns once there is room: the money on the left, where the
          customers have got to on the right. Below lg they stack. */}
      {statement && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EarningsChart
              months={statement.months}
              selected={month || null}
              onSelect={(key) => setMonth(key ?? '')}
            />
          </div>
          <LeadProgress leads={leads} />
        </div>
      )}

      {/* The chart is the month picker, but not everyone taps a bar — these
          say the same thing in a control that reads as one. */}
      {statement && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
            <option value="">Every month</option>
            {lastMonths(statement.months).map((m) => (
              <option key={m.month} value={m.month} disabled={!m.total}>
                {monthLabel(m.month)}
                {m.total ? '' : ' — nothing'}
              </option>
            ))}
          </Select>
          <Select value={paid} onChange={(e) => setPaid(e.target.value)} aria-label="Payment">
            <option value="">Paid and unpaid</option>
            <option value="AWAITING_PAYMENT">Awaiting payment</option>
            <option value="PAID">Paid</option>
          </Select>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-card bg-card shadow-soft">
        {statement === null && !error ? (
          <p className="px-4 py-10 text-center text-sm font-normal text-muted">Loading…</p>
        ) : months.length ? (
          months.map((m) => <MonthRow key={m.month} month={m} />)
        ) : statement?.months.length ? (
          <p className="px-4 py-10 text-center text-sm font-normal text-muted">
            Nothing in that month.
          </p>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="font-bold">No earnings yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm font-normal text-muted">
              You earn when a customer you sent in signs up. Send us your first one and it will show
              up here.
            </p>
            <Link href="/partner/refer" className="mt-5 inline-block">
              <Button>
                <IconPlus className="h-4 w-4" strokeWidth={2} />
                Add a lead
              </Button>
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
