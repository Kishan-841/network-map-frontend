'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { IconOkCircle } from '@/components/ui/icons'
import { RecordPaymentModal, METHODS } from '@/components/payouts/RecordPaymentModal'

const methodLabel = (m) => METHODS.find((x) => x.value === m)?.label ?? m

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
          // Owed rows are grouped, so the partner-month pair IS their identity.
          // Payments already have their own id.
          setData({
            total,
            owed: owed.map((r) => ({ ...r, id: `${r.partnerId}|${r.month}` })),
            settled: settled ?? [],
          })
        })
        .catch((err) => setError(getApiErrorMessage(err, 'Could not load payouts'))),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  /**
   * Save the entry, then refresh. Rethrown as well as shown so the form can
   * stay open with the reason rather than closing on a failure.
   */
  const record = async (entry) => {
    setError(null)
    setNotice(null)
    try {
      const res = await apiClient.post('/payouts/mark-paid', entry)
      const { count, shortfall } = res.data.data
      setNotice(
        `Recorded ${rupees(entry.amountPaid)} to ${paying.partnerName} for ` +
          `${monthLabel(entry.month)} by ${methodLabel(entry.method)}` +
          `${entry.reference ? ` — ${entry.reference}` : ''}. ` +
          `${count} earning${count === 1 ? '' : 's'} settled` +
          `${shortfall > 0 ? `, ${rupees(shortfall)} still short` : ''}.`,
      )
      await load()
    } catch (err) {
      const message = getApiErrorMessage(err, 'Could not record that payment')
      setError(message)
      throw new Error(message)
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
      render: (r) => (
        <button
          type="button"
          onClick={() => setPaying(r)}
          className="whitespace-nowrap rounded-btn border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-ok/60 hover:text-ok"
        >
          Record payment
        </button>
      ),
      className: 'w-px',
    },
  ]

  const settledColumns = [
    {
      key: 'partner',
      header: 'Partner',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{r.partner?.name}</p>
          <p className="truncate text-xs font-normal text-muted">{monthLabel(r.month)}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Paid',
      render: (r) => (
        <div className="min-w-0">
          <p className="font-bold tabular-nums">{rupees(r.amountPaid)}</p>
          {/* Only when it differs — a matching figure needs no comment. */}
          {r.amountOwed !== r.amountPaid && (
            <p className="text-xs font-normal text-warn">of {rupees(r.amountOwed)} owed</p>
          )}
        </div>
      ),
      className: 'whitespace-nowrap text-right',
    },
    {
      key: 'method',
      header: 'How',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{methodLabel(r.method)}</p>
          {r.reference && (
            <p className="truncate font-mono text-xs font-normal text-muted">{r.reference}</p>
          )}
        </div>
      ),
      className: 'max-w-[200px]',
    },
    {
      key: 'paidOn',
      header: 'Paid on',
      render: (r) => (r.paidOn ? paidOn.format(new Date(r.paidOn)) : '—'),
      className: 'whitespace-nowrap tabular-nums text-muted',
    },
    {
      key: 'recordedBy',
      header: 'Entered by',
      render: (r) => r.recordedBy?.name ?? 'unknown',
      className: 'text-muted',
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
              onClick={() => setPaying(r)}
              className="mt-3 w-full rounded-btn border border-line py-2 text-sm font-medium transition-colors hover:border-ok/60 hover:text-ok"
            >
              Record payment
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
                    <p className="truncate font-medium">{r.partner?.name}</p>
                    <p className="truncate text-xs font-normal text-muted">
                      {monthLabel(r.month)} · {methodLabel(r.method)}
                      {r.reference ? ` · ${r.reference}` : ''}
                    </p>
                    <p className="truncate text-xs font-normal text-faint">
                      {r.paidOn ? paidOn.format(new Date(r.paidOn)) : '—'} · entered by{' '}
                      {r.recordedBy?.name ?? 'unknown'}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold tabular-nums text-ok">
                    {rupees(r.amountPaid)}
                  </p>
                </div>
              </div>
            )}
          />
        </>
      )}

      {paying && (
        <RecordPaymentModal
          key={paying.id}
          row={paying}
          submit={record}
          onClose={() => setPaying(null)}
          onRecorded={() => setPaying(null)}
        />
      )}
    </main>
  )
}
