'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/PageHeader'
import { leadStatusClass } from '@/lib/lead-status'
import { IconOkCircle } from '@/components/ui/icons'

const rupees = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`
const shortMonth = (key) => {
  const [y, m] = String(key).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'short',
    timeZone: 'UTC',
  })
}
const when = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
})
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

function Tile({ label, value, sub, tone = '' }) {
  return (
    <div className="rounded-card bg-card p-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs font-normal text-muted">{sub}</p>}
    </div>
  )
}

/**
 * Leads arriving against leads converting, six months.
 *
 * Paired bars, not stacked: converted is a SUBSET of added, so a stack would
 * draw a total that does not exist. The gap between them is the conversion.
 */
function LeadsChart({ months }) {
  const peak = Math.max(...months.map((m) => m.added), 1)
  const any = months.some((m) => m.added > 0)
  return (
    <div className="rounded-card bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold">Leads by month</h2>
      <div className="mt-5 flex h-32 items-end gap-2" role="group" aria-label="Leads by month">
        {months.map((m) => {
          const h = (n) => (any && n ? Math.max((n / peak) * 100, 6) : 0)
          return (
            <div key={m.month} className="flex h-full flex-1 flex-col justify-end gap-1.5">
              <span className="flex w-full flex-1 items-end justify-center gap-1">
                <span
                  className="w-1/2 rounded-t-[3px] bg-fiber"
                  style={{ height: `${h(m.added)}%` }}
                  aria-label={`${m.month}: ${m.added} added`}
                />
                <span
                  className="w-1/2 rounded-t-[3px] bg-ok"
                  style={{ height: `${h(m.converted)}%` }}
                  aria-label={`${m.month}: ${m.converted} converted`}
                />
              </span>
              <span className="text-center text-[11px] font-medium text-faint">
                {shortMonth(m.month)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 border-t border-line/60 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-fiber" /> Added
        </span>
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-ok" /> Converted
        </span>
      </div>
    </div>
  )
}

/** Who is actually producing. Ranked by leads, because that is the job. */
function TopPartners({ rows }) {
  const peak = Math.max(...rows.map((r) => r.leads), 1)
  return (
    <div className="rounded-card bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold">Busiest partners</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm font-normal text-muted">
          Nobody has sent a customer in yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/leads?partnerId=${r.id}`}
                  className="min-w-0 truncate text-xs font-medium underline-offset-2 hover:text-primary hover:underline"
                >
                  {r.name}
                </Link>
                <span className="shrink-0 text-xs font-normal tabular-nums text-muted">
                  {r.converted}/{r.leads} · {rupees(r.earnings)}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full rounded-full bg-fiber"
                  style={{ width: `${Math.max((r.leads / peak) * 100, 6)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A lead you should act on, with the reason it is here. */
function WorkRow({ lead, reason }) {
  return (
    <li className="flex items-center gap-3 border-b border-line/70 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{lead.customerName}</span>
        <span className="block truncate text-xs font-normal text-muted">
          {lead.customerMobile}
          {lead.partner?.name ? ` · from ${lead.partner.name}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-xs font-normal text-muted">{reason}</span>
    </li>
  )
}

/**
 * The partner manager's overview.
 *
 * The two lists at the bottom are the point. Counts describe what happened;
 * "these four people are waiting for a call" is what you do next, and a
 * dashboard that only describes is one nobody opens twice.
 */
export default function PartnerDashboardPage() {
  const name = useAuthStore((s) => s.user?.name)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/partner-dashboard')
      .then((res) => !cancelled && setData(res.data.data))
      .catch((err) => !cancelled && setError(getApiErrorMessage(err, 'Could not load the overview')))
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader
        title={name ? `Hello, ${name.split(' ')[0]}` : 'Overview'}
        sub="Your partners, their customers, and what needs doing"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Partners"
          value={data ? data.partners.total : '—'}
          sub={data ? `${data.partners.approved} approved · ${data.partners.pending} waiting` : ''}
        />
        <Tile
          label="Leads this month"
          value={data ? data.leads.thisMonth : '—'}
          sub={data ? `${data.leads.total} in all` : ''}
        />
        <Tile
          label="Converted"
          value={data ? `${data.leads.conversionRate}%` : '—'}
          sub={data ? `${data.leads.converted} of ${data.leads.total}` : ''}
          tone="text-ok"
        />
        <Tile
          label="Needs you"
          value={data ? data.waiting : '—'}
          sub={data ? `${data.introductions.open} introduction${data.introductions.open === 1 ? '' : 's'} open` : ''}
          tone={data?.waiting ? 'text-warn' : ''}
        />
      </div>

      {data && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LeadsChart months={data.byMonth} />
            <TopPartners rows={data.topPartners} />
          </div>

          {/* The work. Two short lists rather than one long one, because
              "they asked us to call back" and "nobody has called at all" are
              different problems with different urgency. */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-card bg-card p-5 shadow-soft">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-bold">Call backs due</h2>
                {data.dueCalls.length > 0 && (
                  <Link href="/leads" className="text-xs font-medium text-primary hover:underline">
                    Open leads
                  </Link>
                )}
              </div>
              {data.dueCalls.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 text-sm font-normal text-muted">
                  <IconOkCircle className="h-4 w-4 text-ok" strokeWidth={2} />
                  Nobody is waiting on a call back.
                </p>
              ) : (
                <ul className="mt-3">
                  {data.dueCalls.map((lead) => (
                    <WorkRow
                      key={lead.id}
                      lead={lead}
                      reason={<span className="text-warn">{when.format(new Date(lead.nextCallAt))}</span>}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-card bg-card p-5 shadow-soft">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-bold">Not called yet</h2>
                {data.untouchedLeads.length > 0 && (
                  <Link
                    href="/leads?status=NEW"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    See all
                  </Link>
                )}
              </div>
              {data.untouchedLeads.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 text-sm font-normal text-muted">
                  <IconOkCircle className="h-4 w-4 text-ok" strokeWidth={2} />
                  Every lead has been picked up.
                </p>
              ) : (
                <ul className="mt-3">
                  {data.untouchedLeads.map((lead) => (
                    <WorkRow
                      key={lead.id}
                      lead={lead}
                      reason={
                        <span
                          className={`rounded-full px-2 py-0.5 ${leadStatusClass(lead.status)}`}
                        >
                          {day.format(new Date(lead.createdAt))}
                        </span>
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs font-normal text-faint">
            {rupees(data.earnings.total)} earned by your partners in all
            {data.earnings.thisMonth > 0 && `, ${rupees(data.earnings.thisMonth)} this month`}.
          </p>
        </>
      )}
    </main>
  )
}
