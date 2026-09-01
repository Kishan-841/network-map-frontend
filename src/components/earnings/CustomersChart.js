'use client'

import { lastMonths, monthNames } from '@/components/earnings/EarningsChart'

/**
 * Customers sent in against customers who signed up, month by month.
 *
 * Paired bars rather than stacked: activated is a SUBSET of added, and
 * stacking two overlapping quantities draws a total that does not exist.
 * Side by side, the gap between them is the conversion — which is the thing
 * worth looking at.
 *
 * Both bars share one scale, so "added" being taller always means more.
 */
export function CustomersChart({ months }) {
  const slots = lastMonths(months)
  const peak = Math.max(...slots.map((m) => Math.max(m.added ?? 0, m.activated ?? 0)), 1)
  const anything = slots.some((m) => (m.added ?? 0) + (m.activated ?? 0) > 0)

  return (
    <div className="rounded-card bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold">Customers by month</h2>

      <div className="mt-5 flex h-32 items-end gap-2" role="group" aria-label="Customers by month">
        {slots.map((m) => {
          const added = m.added ?? 0
          const activated = m.activated ?? 0
          const { short, long } = monthNames(m.month)
          const height = (n) => (anything && n ? Math.max((n / peak) * 100, 6) : 0)
          return (
            <div
              key={m.month}
              className="flex h-full flex-1 flex-col justify-end gap-1.5"
              title={`${long}: ${added} sent in, ${activated} signed up`}
            >
              <span className="flex w-full flex-1 items-end justify-center gap-1">
                <span
                  className="w-1/2 rounded-t-[3px] bg-fiber"
                  style={{ height: `${height(added)}%` }}
                  aria-label={`${long}: ${added} sent in`}
                />
                <span
                  className="w-1/2 rounded-t-[3px] bg-ok"
                  style={{ height: `${height(activated)}%` }}
                  aria-label={`${long}: ${activated} signed up`}
                />
              </span>
              <span className="text-center text-[11px] font-medium text-faint">{short}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line/60 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-fiber" />
          Sent in
        </span>
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-ok" />
          Signed up
        </span>
      </div>
    </div>
  )
}
