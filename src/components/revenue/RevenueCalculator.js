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

  const cleared = grandTotal === 0

  return (
    <div className="overflow-hidden rounded-card bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-0">
          <thead>
            <tr>
              {/* Rules mark the three zones: what plan, what you enter, what
                  it comes to. */}
              <th className="border-r border-line px-5 pb-3 pt-5 text-left text-xs font-medium uppercase tracking-wide text-faint">
                Speed
              </th>
              {card.periods.map((period) => (
                <th key={period} className="px-2 pb-3 pt-5 text-center">
                  <span className="block text-sm font-bold">{PERIOD_LABEL[period]}</span>
                  <span className="block text-xs font-normal text-faint">
                    {PERIOD_HINT[period]}
                  </span>
                </th>
              ))}
              {/* The rule marks where typing ends and results begin — the
                  same split the eye is already making. */}
              <th className="whitespace-nowrap border-l border-line bg-paper/50 px-5 pb-3 pt-5 text-right text-xs font-medium uppercase tracking-wide text-faint">
                You earn
              </th>
            </tr>
          </thead>
          <tbody>
            {card.speeds.map((speed) => (
              <tr key={speed} className="group">
                <td className="border-r border-t border-line px-5 py-3.5">
                  <span className="whitespace-nowrap text-base font-bold">{speed}</span>
                  <span className="ml-1 text-xs font-normal text-muted">Mbps</span>
                </td>
                {card.periods.map((period) => {
                  const rate = rateFor(speed, period)
                  const filled = Number(counts[key(speed, period)] ?? 0) > 0
                  return (
                    <td key={period} className="border-t border-line px-2 py-3.5">
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
                        // A cell with a number in it carries weight; an empty
                        // one stays quiet, so the filled ones are findable.
                        className={`h-11 w-full min-w-[64px] rounded-btn border text-center text-base tabular-nums outline-none transition-colors focus:border-fiber focus:ring-2 focus:ring-fiber/15 disabled:opacity-40 ${
                          filled
                            ? 'border-fiber/40 bg-fiber-tint font-bold text-ink'
                            : 'border-line bg-card'
                        }`}
                      />
                      <span className="mt-1.5 block text-center text-[11px] font-normal text-faint">
                        {rate ? `${rupees(rate)} each` : '—'}
                      </span>
                    </td>
                  )
                })}
                <td className="border-l border-t border-line bg-paper/50 px-5 py-3.5 text-right align-middle">
                  {/* ₹0 rather than a dash: a dash is a different width and a
                      different shape, so it breaks the column it sits in.
                      Kept faint, so an empty row still recedes. */}
                  <span
                    className={`whitespace-nowrap text-base tabular-nums ${
                      rowTotals[speed] ? 'font-bold' : 'font-normal text-faint'
                    }`}
                  >
                    {rupees(rowTotals[speed] ?? 0)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The result. Two figures of equal weight, because "how many people"
          and "how much money" are one sentence — the divider is what joins
          them rather than what separates them. It turns horizontal on a
          phone, where side by side would squeeze both. */}
      <div className="border-t-2 border-line bg-paper/40">
        <div className="flex flex-col divide-y divide-line sm:flex-row sm:divide-x sm:divide-y-0">
          <div className="px-5 py-5 sm:w-[38%] sm:shrink-0">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">Customers</p>
            <p className="mt-1 text-4xl font-bold tabular-nums leading-none">{customerCount}</p>
          </div>
          <div className="min-w-0 flex-1 px-5 py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">
              You could earn
            </p>
            <p className="mt-1 truncate text-4xl font-bold tabular-nums leading-none text-fiber">
              {rupees(grandTotal)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          <p className="text-xs font-normal text-muted">
            An estimate at today&rsquo;s rates. What you actually earn depends on how many
            customers sign up.
          </p>
          {!cleared && (
            <button
              type="button"
              onClick={() => setCounts({})}
              className="shrink-0 text-sm font-medium text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
            >
              Start again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
