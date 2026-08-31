'use client'

const rupees = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`

/** "2026-08" → { short: "Aug", long: "August 2026" } */
export const monthNames = (key) => {
  const [year, month] = key.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, 1))
  return {
    short: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
    long: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  }
}

/**
 * The last `count` months ending today, whether or not anything was earned in
 * them. A month with nothing has to be drawn, not skipped: an axis that only
 * shows the good months turns a quiet spell into a straight line and hides
 * exactly what a partner needs to see.
 */
export function lastMonths(months, count = 6) {
  const bySlot = new Map(months.map((m) => [m.month, m]))
  const now = new Date()
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    out.push(bySlot.get(key) ?? { month: key, total: 0, paid: 0, outstanding: 0, count: 0, lines: [] })
  }
  return out
}

/**
 * Earnings by month.
 *
 * A column per month, split into what has been paid and what is still owed —
 * those are the two questions a partner actually has, and one bar of "total"
 * answers neither.
 *
 * Paid is solid; awaiting is hatched. That is not decoration: the brand's
 * success and warning greens/ambers sit at ΔE 7.2 under protanopia, which is
 * too close to carry meaning on colour alone, so the texture does the work for
 * anyone who cannot separate the hues. The legend and the list below say it in
 * words as well.
 *
 * Tapping a column filters the list to that month, so the chart is the month
 * picker rather than a picture beside one.
 */
export function EarningsChart({ months, selected, onSelect }) {
  const slots = lastMonths(months)
  const peak = Math.max(...slots.map((m) => m.total), 1)
  const anything = slots.some((m) => m.total > 0)

  return (
    <div className="rounded-card bg-card p-5 shadow-soft">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold">Month by month</h2>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs font-medium text-primary transition-opacity hover:opacity-70"
          >
            Show all
          </button>
        )}
      </div>

      <div className="mt-5 flex h-32 items-end gap-2" role="group" aria-label="Earnings by month">
        {slots.map((m) => {
          const dim = selected && selected !== m.month
          const height = anything ? Math.max((m.total / peak) * 100, m.total > 0 ? 6 : 0) : 0
          const paidPct = m.total ? (m.paid / m.total) * 100 : 0
          const { short, long } = monthNames(m.month)
          return (
            <button
              key={m.month}
              type="button"
              disabled={!m.total}
              aria-pressed={selected === m.month}
              aria-label={
                m.total
                  ? `${long}: ${rupees(m.total)} from ${m.count} ${m.count === 1 ? 'customer' : 'customers'}`
                  : `${long}: nothing earned`
              }
              onClick={() => onSelect(selected === m.month ? null : m.month)}
              className="group flex h-full flex-1 flex-col justify-end gap-1.5 disabled:cursor-default"
            >
              {/* The plot area. Bars grow from a shared baseline so their
                  heights are comparable at a glance. */}
              <span className="relative flex w-full flex-1 items-end">
                <span
                  className={`flex w-full flex-col-reverse overflow-hidden rounded-t-[4px] transition-opacity duration-200 ${
                    dim ? 'opacity-35' : 'opacity-100'
                  } ${m.total ? 'group-hover:opacity-80' : ''}`}
                  style={{ height: `${height}%` }}
                >
                  {m.paid > 0 && (
                    <span className="w-full shrink-0 bg-ok" style={{ height: `${paidPct}%` }} />
                  )}
                  {m.outstanding > 0 && (
                    <span
                      className="w-full shrink-0 border-t-2 border-card bg-warn"
                      style={{
                        height: `${100 - paidPct}%`,
                        // The hatch, so the two segments stay apart for a
                        // reader who cannot separate green from amber.
                        backgroundImage:
                          'repeating-linear-gradient(45deg, rgba(255,255,255,.45) 0 2px, transparent 2px 6px)',
                        // No border when it is the whole bar — that line marks
                        // the split between segments, not the bar's own top.
                        borderTopWidth: m.paid > 0 ? 2 : 0,
                      }}
                    />
                  )}
                </span>
              </span>
              <span
                className={`text-[11px] font-medium ${
                  selected === m.month ? 'text-ink' : 'text-faint'
                }`}
              >
                {short}
              </span>
            </button>
          )
        })}
      </div>

      {/* Two series, so a legend is always present — identity is never left to
          colour alone. */}
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line/60 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-ok" />
          Paid
        </span>
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted">
          <span
            className="h-2.5 w-2.5 rounded-[2px] bg-warn"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(255,255,255,.45) 0 2px, transparent 2px 6px)',
            }}
          />
          Awaiting payment
        </span>
        {anything && (
          <span className="ml-auto text-xs font-normal text-faint">Tap a month to see it</span>
        )}
      </div>
    </div>
  )
}
