'use client'

import { useState } from 'react'

/**
 * Chart primitives for the acquisition dashboard.
 *
 * Design rules applied:
 * - Each chart shows ONE measure, so marks use a single hue from the theme
 *   (var(--color-fiber)) — categorical palettes are for identity, not
 *   magnitude. Using the token means every DaisyUI theme and dark mode work
 *   automatically instead of being flipped.
 * - Identity is never colour-alone: every bar carries a text label + value in
 *   ink tokens, and the agents table below the charts is the table view.
 * - Thin marks, rounded data-ends, recessive axes, hover tooltips everywhere.
 */

const fmtDay = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

/** Local YYYY-MM-DD — never toISOString(), which shifts by the UTC offset. */
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Fill missing days with zeros so gaps read as "no work", not "no data". */
export function fillDays(trend = [], from, to) {
  if (!from || !to) return trend
  const byDate = new Map(trend.map((t) => [t.date, Number(t.count)]))
  const out = []
  const cursor = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (cursor <= end && out.length < 400) {
    const key = dayKey(cursor)
    out.push({ date: key, count: byDate.get(key) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export function ChartCard({ title, subtitle, children, empty }) {
  return (
    <section className="rounded-card bg-card p-4 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs font-normal text-muted">{subtitle}</p>}
      <div className="mt-3">
        {empty ? <p className="py-6 text-sm font-normal text-muted">{empty}</p> : children}
      </div>
    </section>
  )
}

/** Area + line, one series. Crosshair follows the pointer. */
export function TrendChart({ points }) {
  const [hover, setHover] = useState(null)
  if (!points?.length) return null

  const W = 720
  const H = 180
  const PAD = { top: 12, right: 12, bottom: 24, left: 32 }
  const max = Math.max(1, ...points.map((p) => p.count))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v) => PAD.top + innerH - (v / max) * innerH

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.count)}`).join(' ')
  const area = `${line} L ${x(points.length - 1)} ${PAD.top + innerH} L ${x(0)} ${PAD.top + innerH} Z`
  // Label at most ~6 ticks so the axis never collides.
  const tickEvery = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 180 }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * W
          const i = Math.round(((px - PAD.left) / innerW) * (points.length - 1))
          setHover(Math.min(points.length - 1, Math.max(0, i)))
        }}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="currentColor"
              className="text-line"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={y(max * f) + 3}
              textAnchor="end"
              className="fill-faint text-[9px] tabular-nums"
            >
              {Math.round(max * f)}
            </text>
          </g>
        ))}

        <path d={area} fill="var(--color-fiber)" fillOpacity="0.12" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-fiber)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) =>
          i % tickEvery === 0 || i === points.length - 1 ? (
            <text
              key={p.date}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-faint text-[9px]"
            >
              {fmtDay(p.date)}
            </text>
          ) : null,
        )}

        {hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--color-fiber)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {/* 2px surface ring keeps the marker readable over the area fill */}
            <circle
              cx={x(hover)}
              cy={y(points[hover].count)}
              r="5"
              fill="var(--color-fiber)"
              stroke="var(--color-card)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-btn border border-line bg-card px-2.5 py-1 text-xs shadow-lift"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <span className="font-medium">{points[hover].count}</span>
          <span className="text-muted"> on {fmtDay(points[hover].date)}</span>
        </div>
      )}
    </div>
  )
}

/** Horizontal ranked bars — one measure, direct value labels. */
export function BarList({ rows, emptyLabel = 'Nothing yet', unit = '', limit = 8 }) {
  if (!rows?.length) return <p className="py-4 text-sm font-normal text-muted">{emptyLabel}</p>
  const max = Math.max(1, ...rows.map((r) => r.value))
  const shown = rows.slice(0, limit)
  const hidden = rows.length - shown.length
  return (
    <ul className="flex flex-col gap-2.5">
      {shown.map((row, i) => (
        // Labels can repeat (two agents with the same name), so the key pairs
        // the caller's id with the position.
        <li key={row.id ?? `${row.label}-${i}`} title={`${row.label}: ${row.value}${unit}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm">
              {row.label}
              {row.sub && <span className="ml-2 text-xs text-muted">{row.sub}</span>}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {row.value}
              {unit}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                backgroundColor: 'var(--color-fiber)',
                opacity: row.value === 0 ? 0.25 : 1,
              }}
            />
          </div>
        </li>
      ))}
      {hidden > 0 && (
        <li className="pt-1 text-xs font-normal text-muted">+{hidden} more</li>
      )}
    </ul>
  )
}
