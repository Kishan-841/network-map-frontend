'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { Button } from '@/components/ui/Button'
import { IconChevronDown, IconPlus } from '@/components/ui/icons'
import { EarningsChart, lastMonths, monthNames } from '@/components/earnings/EarningsChart'
import { CustomersChart } from '@/components/earnings/CustomersChart'

const rupees = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`

const PERIOD_LABEL = {
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  YEARLY: 'Yearly',
}

/** "2026-08" → "August 2026". Parsed as a date, not string-sliced. */
const monthLabel = (key) => monthNames(key).long

/**
 * A month, and — when opened — the customers who made it up.
 *
 * The breakdown lives inside the row rather than on a second list further
 * down the page: two month lists on one screen is the same information twice,
 * and the reader has to work out whether they disagree.
 */
function MonthRows({ month, open, onToggle }) {
  const cell = 'px-4 py-3 text-right tabular-nums'
  return (
    <>
      <tr
        className={`border-b border-line/60 transition-colors hover:bg-paper/60 ${
          open ? 'bg-paper/60' : ''
        }`}
      >
        <td className="whitespace-nowrap px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            disabled={!month.lines.length}
            className="flex items-center gap-2 font-medium disabled:cursor-default"
          >
            <IconChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform ${
                open ? 'rotate-180' : ''
              } ${month.lines.length ? '' : 'invisible'}`}
              strokeWidth={2.2}
            />
            {monthLabel(month.month)}
          </button>
        </td>
        <td className={`${cell} text-muted`}>{month.added}</td>
        <td className={cell}>{month.activated}</td>
        <td className={`${cell} font-medium`}>{rupees(month.total)}</td>
        <td className={`${cell} text-ok`}>{month.paid ? rupees(month.paid) : '—'}</td>
      </tr>

      {open &&
        month.lines.map((line) => (
          <tr key={line.id} className="border-b border-line/60 bg-paper/30 text-xs">
            <td className="py-2 pl-11 pr-4">
              <span className="block truncate font-medium">{line.customerName ?? 'Customer'}</span>
              <span className="block text-muted">
                {line.speedMbps} Mbps · {PERIOD_LABEL[line.billingPeriod] ?? line.billingPeriod}
              </span>
            </td>
            <td />
            <td className="px-4 py-2 text-right">
              {line.status === 'PAID' ? (
                <span className="text-ok">Paid</span>
              ) : (
                <span className="text-warn">Awaiting</span>
              )}
            </td>
            <td className="px-4 py-2 text-right tabular-nums">{rupees(line.amount)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-ok">
              {line.status === 'PAID' ? rupees(line.amount) : '—'}
            </td>
          </tr>
        ))}
    </>
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
  const [openMonth, setOpenMonth] = useState(null)

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

  const months = useMemo(() => {
    const all = statement?.months ?? []
    return all.filter((m) => !month || m.month === month)
  }, [statement, month])

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

      {/* The three numbers the partner came for: how many signed up, what
          that earned, and how much has actually arrived. */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-card bg-card p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">
            Customers activated
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums">
            {statement ? statement.activated : '—'}
          </p>
          {statement && (
            <p className="mt-0.5 text-xs font-normal text-muted">of {statement.added} sent in</p>
          )}
        </div>
        <div className="rounded-card bg-card p-5 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Total earnings</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums">
            {statement ? rupees(statement.total) : '—'}
          </p>
          {statement && (
            <p className="mt-0.5 text-xs font-normal text-warn">
              {rupees(statement.outstanding)} awaiting
            </p>
          )}
        </div>
        <div className="col-span-2 rounded-card bg-card p-5 shadow-soft lg:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Paid to you</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-ok">
            {statement ? rupees(statement.paid) : '—'}
          </p>
          {statement && statement.total > 0 && (
            <p className="mt-0.5 text-xs font-normal text-muted">
              {Math.round((statement.paid / statement.total) * 100)}% of what you have earned
            </p>
          )}
        </div>
      </div>

      {/* Month by month, as a table: the numbers side by side are easier to
          compare than the same numbers spread across cards. */}
      {statement && statement.months.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-card bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-faint">
                    Month
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-faint">
                    Sent in
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-faint">
                    Signed up
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-faint">
                    Earned
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-faint">
                    Paid
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <MonthRows
                    key={m.month}
                    month={m}
                    open={openMonth === m.month}
                    onToggle={() =>
                      setOpenMonth((current) => (current === m.month ? null : m.month))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {statement && statement.months.length === 0 && (
        <div className="mt-4 rounded-card bg-card px-6 py-12 text-center shadow-soft">
          <p className="font-bold">Nothing yet</p>
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

      {/* Two columns once there is room. Below lg they stack. */}
      {statement && statement.months.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <EarningsChart
              months={statement.months}
              selected={month || null}
              onSelect={(key) => setMonth(key ?? '')}
            />
          </div>
          <CustomersChart months={statement.months} />
        </div>
      )}

    </>
  )
}
