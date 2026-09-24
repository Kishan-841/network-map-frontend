'use client'

/** A ranked horizontal bar chart — one labelled, value-tagged bar per row. */
function RankedBars({ rows, color = 'var(--color-fiber)', empty = 'No data yet.' }) {
  if (!rows.length) return <p className="text-sm font-normal text-muted">{empty}</p>
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.id} title={`${r.label}: ${r.value}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-ink">{r.label}</span>
            <span className="shrink-0 tabular-nums font-medium text-ink">
              {r.value}
              {r.sub ? <span className="font-normal text-muted"> {r.sub}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-paper">
            <div
              className="h-2.5 rounded-full transition-[width] duration-300"
              style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color, minWidth: r.value > 0 ? '0.5rem' : 0 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Visits per team member (ranked), with the inquiry count as a muted tag. */
export function TeamPerformanceChart({ team }) {
  const rows = [...team]
    .sort((a, b) => b.visits - a.visits || b.inquiries - a.inquiries)
    .map((u) => ({ id: u.id, label: u.name, value: u.visits, sub: `· ${u.inquiries} inq` }))
  return <RankedBars rows={rows} color="var(--color-fiber)" empty="No team members." />
}
