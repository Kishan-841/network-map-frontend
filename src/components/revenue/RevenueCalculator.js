'use client'

import { useEffect, useMemo, useState } from 'react'

const PERIOD_LABEL = {
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  YEARLY: 'Yearly',
}
const PERIOD_HINT = {
  QUARTERLY: '3 months',
  HALF_YEARLY: '6 months',
  YEARLY: '12 months',
}

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/**
 * The pitch tool. Speeds down the side, billing periods across the top; the
 * partner types how many customers they think they can bring into each cell
 * and watches the money add up.
 *
 * Written for someone who has never used a web app (partner-network.md §0):
 * numeric keypad on phones, an empty box rather than a distracting 0, each
 * row totalled beside it so the arithmetic is visible rather than magic, and
 * one big total at the end.
 *
 * `client` is injected so the same component serves the partner portal and
 * the employee's app, which use different API clients and tokens.
 */
export function RevenueCalculator({ client, endpoint }) {
  const [card, setCard] = useState(null)
  const [error, setError] = useState(null)
  const [counts, setCounts] = useState({})

  useEffect(() => {
    let cancelled = false
    client
      .get(endpoint)
      .then((res) => !cancelled && setCard(res.data.data))
      .catch(() => !cancelled && setError('Could not load the rates. Please try again.'))
    return () => {
      cancelled = true
    }
  }, [client, endpoint])

  const key = (speed, period) => `${speed}|${period}`

  // One lookup built from the rates, rather than a find() per cell per render.
  const rateByCell = useMemo(() => {
    const map = new Map()
    for (const r of card?.rates ?? []) map.set(key(r.speedMbps, r.billingPeriod), r.amount)
    return map
  }, [card])
  const rateFor = (speed, period) => rateByCell.get(key(speed, period)) ?? null

  const { rowTotals, grandTotal, customerCount } = useMemo(() => {
    const rows = {}
    let total = 0
    let people = 0
    for (const speed of card?.speeds ?? []) {
      let row = 0
      for (const period of card?.periods ?? []) {
        const n = Number(counts[key(speed, period)] ?? 0)
        const rate = rateByCell.get(key(speed, period)) ?? null
        if (n > 0 && rate) {
          row += rate * n
          people += n
        }
      }
      rows[speed] = row
      total += row
    }
    return { rowTotals: rows, grandTotal: total, customerCount: people }
  }, [card, counts, rateByCell])

  if (error) return <p className="text-sm font-normal text-bad">{error}</p>
  if (!card) return <p className="text-sm font-normal text-muted">Loading…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-card bg-card p-4 shadow-soft">
        <table className="w-full min-w-[420px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="pb-3 pr-3 text-left text-xs font-medium uppercase tracking-wide text-faint">
                Speed
              </th>
              {card.periods.map((period) => (
                <th key={period} className="px-2 pb-3 text-center">
                  <span className="block text-sm font-medium">{PERIOD_LABEL[period]}</span>
                  <span className="block text-xs font-normal text-muted">{PERIOD_HINT[period]}</span>
                </th>
              ))}
              <th className="pb-3 pl-3 text-right text-xs font-medium uppercase tracking-wide text-faint">
                You earn
              </th>
            </tr>
          </thead>
          <tbody>
            {card.speeds.map((speed) => (
              <tr key={speed}>
                <td className="border-t border-line py-3 pr-3">
                  <span className="whitespace-nowrap text-sm font-bold">{speed} Mbps</span>
                </td>
                {card.periods.map((period) => {
                  const rate = rateFor(speed, period)
                  return (
                    <td key={period} className="border-t border-line px-2 py-3">
                      <input
                        id={`cell-${speed}-${period}`}
                        aria-label={`${speed} Mbps, ${PERIOD_LABEL[period]}: number of customers`}
                        type="text"
                        inputMode="numeric"
                        disabled={!rate}
                        placeholder="0"
                        value={counts[key(speed, period)] ?? ''}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setCounts((prev) => ({ ...prev, [key(speed, period)]: digits }))
                        }}
                        className="h-11 w-full min-w-[56px] rounded-btn border border-line bg-card text-center text-base tabular-nums outline-none focus:border-fiber disabled:opacity-40"
                      />
                      {/* The unit rate, so the total is never a black box. */}
                      <span className="mt-1 block text-center text-[11px] font-normal text-faint">
                        {rate ? `${rupees(rate)} each` : '—'}
                      </span>
                    </td>
                  )
                })}
                <td className="border-t border-line py-3 pl-3 text-right">
                  <span className="whitespace-nowrap text-sm font-bold tabular-nums">
                    {rowTotals[speed] ? rupees(rowTotals[speed]) : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-card bg-card p-5 shadow-soft">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">You could earn</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{rupees(grandTotal)}</p>
          </div>
          <p className="shrink-0 text-sm font-normal text-muted">
            {customerCount} customer{customerCount === 1 ? '' : 's'}
          </p>
        </div>
        <p className="mt-3 border-t border-line pt-3 text-xs font-normal text-muted">
          An estimate based on today&rsquo;s rates. What you actually earn depends on how many
          customers sign up.
        </p>
        {grandTotal > 0 && (
          <button
            type="button"
            onClick={() => setCounts({})}
            className="mt-3 text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Start again
          </button>
        )}
      </div>
    </div>
  )
}
