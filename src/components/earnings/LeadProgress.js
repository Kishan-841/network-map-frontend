'use client'

import { LEAD_STATUSES, leadStatusFill, PARTNER_LEAD_STATUS_LABEL } from '@/lib/lead-status'

/**
 * Where a partner's customers have got to.
 *
 * A ranked bar list, not a pie: seven slices of a circle cannot be compared
 * by eye, and the question here is "how many" rather than "what share". Rows
 * stay in PIPELINE order rather than by size, because the order is the
 * journey — sent, called, interested, signed up — and re-sorting it by count
 * would throw away the one thing the sequence is telling you.
 *
 * Every row carries its own number in text, so the colour is a label and
 * never the only way to read it.
 */
export function LeadProgress({ leads }) {
  if (!leads) {
    return (
      <div className="rounded-card bg-card p-5 shadow-soft">
        <h2 className="text-sm font-bold">Your customers</h2>
        <p className="mt-5 text-sm font-normal text-muted">Loading…</p>
      </div>
    )
  }

  const counts = new Map()
  for (const lead of leads) counts.set(lead.status, (counts.get(lead.status) ?? 0) + 1)
  // Only the stages this partner has actually reached — a column of zeroes
  // says nothing and pushes the real rows off the card.
  const shown = LEAD_STATUSES.filter((s) => counts.get(s)).map((s) => [s, counts.get(s)])
  const peak = Math.max(...shown.map(([, n]) => n), 1)
  const signed = counts.get('CONVERTED') ?? 0

  return (
    <div className="flex h-full flex-col rounded-card bg-card p-5 shadow-soft">
      <h2 className="text-sm font-bold">Your customers</h2>

      {leads.length === 0 ? (
        <p className="mt-4 text-sm font-normal text-muted">
          Nothing sent in yet. Add a lead and you will see how each one is going here.
        </p>
      ) : (
        <>
          {/* The one number they came for, before the breakdown. */}
          {/* A real space, not a margin: a margin looks like a gap but reads
              as "2of 6" to anything consuming the text. */}
          <p className="mt-1 text-sm font-normal text-muted">
            <span className="text-2xl font-bold text-ink">{signed}</span>{' '}
            of {leads.length} signed up
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            {shown.map(([status, n]) => (
              <li key={status}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-xs font-medium text-muted">
                    {PARTNER_LEAD_STATUS_LABEL[status] ?? status}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums">{n}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper">
                  <div
                    className={`h-full rounded-full ${leadStatusFill(status)}`}
                    // Widths are relative to the biggest stage, so the shape of
                    // the funnel is visible even when every count is small.
                    style={{ width: `${Math.max((n / peak) * 100, 8)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
