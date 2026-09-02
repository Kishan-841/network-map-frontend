'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { IconOkCircle } from '@/components/ui/icons'

const rupees = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`

/** "2026-08" → "August 2026". Parsed as a date, not string-sliced. */
const monthLabel = (key) => {
  const [year, month] = String(key).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
const paidOn = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Payouts — what partners are owed, and recording that they have been paid.
 *
 * Grouped per partner per month because that is how the money actually moves:
 * you pay someone once for August, not once per customer.
 *
 * There is no way to un-pay from here, by design. partner-network.md §6.2
 * settles that a paid earning is immutable — money that can be silently
 * rewritten is money nobody trusts — so a correction is an adjustment
 * somebody signs for, not an edit.
 */
export default function PayoutsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [paying, setPaying] = useState(null)

  const load = useCallback(
    () =>
      apiClient
        .get('/payouts')
        .then((res) => {
          const { owed, settled, total } = res.data.data
          // A payout row is one partner-month, so that pair IS its identity.
          const withId = (rows) => rows.map((r) => ({ ...r, id: `${r.partnerId}|${r.month}` }))
          setData({ total, owed: withId(owed), settled: withId(settled ?? []) })
        })
        .catch((err) => setError(getApiErrorMessage(err, 'Could not load payouts'))),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const markPaid = async (row) => {
    setError(null)
    setNotice(null)
    setPaying(row.id)
    try {
      const res = await apiClient.post('/payouts/mark-paid', {
        partnerId: row.partnerId,
        month: row.month,
      })
      const { count, alreadySettled } = res.data.data
      setNotice(
        alreadySettled
          ? `${row.partnerName} — ${monthLabel(row.month)} was already settled. Nothing changed.`
          : `Recorded ${rupees(row.amount)} paid to ${row.partnerName} for ${monthLabel(row.month)} ` +
            `(${count} earning${count === 1 ? '' : 's'}).`,
      )
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not record that payment'))
    } finally {
      setPaying(null)
    }
  }

  const owedColumns = [
    {
      key: 'partner',
      header: 'Partner',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{r.partnerName}</p>
          <p className="truncate text-xs font-normal tabular-nums text-muted">
            +91 {r.partnerMobile}
          </p>
        </div>
      ),
    },
    {
      key: 'month',
      header: 'Month',
      render: (r) => monthLabel(r.month),
      className: 'whitespace-nowrap',
    },
    {
      key: 'count',
      header: 'Customers',
      render: (r) => r.count,
      className: 'text-right tabular-nums text-muted',
    },
    {
      key: 'amount',
      header: 'Owed',
      render: (r) => <span className="font-bold">{rupees(r.amount)}</span>,
      className: 'whitespace-nowrap text-right tabular-nums',
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => {
        const busy = paying === r.id
        return (
          <button
            type="button"
            onClick={() => markPaid(r)}
            disabled={Boolean(paying)}
            className="whitespace-nowrap rounded-btn border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-ok/60 hover:text-ok disabled:opacity-40"
          >
            {busy ? 'Recording…' : 'Mark paid'}
          </button>
        )
      },
      className: 'w-px',
    },
  ]

  const settledColumns = [
    {
      key: 'partner',
      header: 'Partner',
      render: (r) => r.partnerName,
      className: 'text-sm font-medium',
    },
    { key: 'month', header: 'Month', render: (r) => monthLabel(r.month), className: 'whitespace-nowrap' },
    {
      key: 'amount',
      header: 'Paid',
      render: (r) => rupees(r.amount),
      className: 'whitespace-nowrap text-right font-medium tabular-nums',
    },
    {
      key: 'paidAt',
      header: 'Recorded',
      // Who and when, so a payment can always be traced to a person.
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{r.paidAt ? paidOn.format(new Date(r.paidAt)) : '—'}</p>
          <p className="truncate text-xs font-normal text-muted">by {r.paidByName ?? 'unknown'}</p>
        </div>
      ),
      className: 'whitespace-nowrap text-right',
    },
  ]

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Payouts"
        sub={
          data
            ? `${rupees(data.total)} owed across ${data.owed.length} partner-month${
                data.owed.length === 1 ? '' : 's'
              }`
            : 'Loading…'
        }
      />

      {error && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error}
        </p>
      )}
      {notice && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-btn bg-ok-tint px-4 py-3">
          <p className="text-sm font-normal text-ok">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-sm font-medium text-ok/70 hover:text-ok"
          >
            Dismiss
          </button>
        </div>
      )}

      <h2 className="mb-2 text-sm font-bold">Awaiting payment</h2>
      <DataTable
        columns={owedColumns}
        rows={data?.owed ?? null}
        loading={data === null}
        keyField="id"
        renderCard={(r) => (
          <div className="rounded-card bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{r.partnerName}</p>
                <p className="truncate text-sm font-normal text-muted">{monthLabel(r.month)}</p>
              </div>
              <p className="shrink-0 text-lg font-bold tabular-nums">{rupees(r.amount)}</p>
            </div>
            <button
              type="button"
              onClick={() => markPaid(r)}
              disabled={Boolean(paying)}
              className="mt-3 w-full rounded-btn border border-line py-2 text-sm font-medium transition-colors hover:border-ok/60 hover:text-ok disabled:opacity-40"
            >
              {paying === r.id ? 'Recording…' : 'Mark paid'}
            </button>
          </div>
        )}
        emptyState={
          <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-soft">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ok-tint text-ok">
              <IconOkCircle className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <p className="mt-4 font-bold">Nothing owed</p>
            <p className="mt-1 max-w-sm text-sm font-normal text-muted">
              Every partner has been paid for what they have earned so far.
            </p>
          </div>
        }
      />

      {data?.settled?.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-bold">Already paid</h2>
          <DataTable
            columns={settledColumns}
            rows={data.settled}
            keyField="id"
            renderCard={(r) => (
              <div className="rounded-card bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.partnerName}</p>
                    <p className="truncate text-xs font-normal text-muted">
                      {monthLabel(r.month)} · by {r.paidByName ?? 'unknown'}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold tabular-nums text-ok">{rupees(r.amount)}</p>
                </div>
              </div>
            )}
          />
        </>
      )}
    </main>
  )
}
