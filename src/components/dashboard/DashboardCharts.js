'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'

// Recharts accepts CSS custom properties, so charts follow the active theme.
// Live = fiber connection is live (green/red, same as the map markers).
const LIVE_META = [
  { key: 'live', label: 'Live', color: 'var(--ok)' },
  { key: 'notLive', label: 'Not live', color: 'var(--bad)' },
]

const axisProps = {
  tick: { fill: 'var(--muted)', fontSize: 11 },
  stroke: 'var(--line)',
}
const tooltipStyle = {
  contentStyle: {
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--ink)',
  },
  labelStyle: { color: 'var(--muted)' },
  cursor: { fill: 'var(--line)', opacity: 0.3 },
}

/**
 * Home-pass size mix.
 *
 * Tiers are ORDINAL (Bronze < Silver < Gold < Platinum), so the bars stay in
 * tier order rather than sorting by value, and colour is a single-hue ramp
 * that darkens as the tier rises — a sequential scale, not four categorical
 * hues. (The literal metal colours would be a categorical palette with two
 * warm neighbours; the ladder reads better and survives colour-blindness.)
 *
 * Bar length is ONE measure — buildings. Home pass rides along as a direct
 * label instead of a second axis, because a handful of Platinum buildings can
 * carry more home pass than everything below them, and a count alone hides it.
 * Unrated sits below the rule so the rows still reconcile to the total.
 */
export function HomePassTierBar({ byHomePassTier, unratedBuildings = 0 }) {
  const tiers = byHomePassTier ?? []
  const max = Math.max(1, ...tiers.map((t) => t.buildings))
  const totalHomePass = tiers.reduce((sum, t) => sum + (t.homePass ?? 0), 0)
  const hasData = tiers.some((t) => t.buildings > 0) || unratedBuildings > 0
  // Light → dark across the four steps of one hue.
  const RAMP = [0.3, 0.5, 0.75, 1]

  return (
    <div className="rounded-card bg-card p-5 shadow-soft">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
        Buildings by size
      </p>
      <p className="mb-4 text-xs font-normal text-muted">Home-pass tiers</p>
      {!hasData ? (
        <div className="flex h-[180px] items-center justify-center text-sm text-muted">
          No data yet
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {tiers.map((tier, i) => {
              const share = totalHomePass ? Math.round((tier.homePass / totalHomePass) * 100) : 0
              return (
                <li
                  key={tier.key}
                  title={`${tier.label} (${tier.max === null ? `${tier.min}+` : `${tier.min}–${tier.max}`} HP): ${tier.buildings} buildings, ${tier.homePass} home pass`}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm">
                      {tier.label}
                      <span className="ml-2 text-xs text-muted">
                        {tier.max === null ? `${tier.min}+` : `${tier.min}–${tier.max}`} HP
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      <span className="font-bold">{tier.buildings}</span>
                      <span className="text-muted">
                        {' '}
                        · {tier.homePass.toLocaleString('en-IN')} HP
                        {share > 0 ? ` (${share}%)` : ''}
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.max(2, (tier.buildings / max) * 100)}%`,
                        backgroundColor: 'var(--fiber)',
                        opacity: tier.buildings === 0 ? 0.15 : RAMP[i] ?? 1,
                      }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          {unratedBuildings > 0 && (
            <p className="mt-4 border-t border-line pt-3 text-xs font-normal text-muted">
              <span className="font-medium text-ink">{unratedBuildings}</span> building
              {unratedBuildings === 1 ? '' : 's'} with no home pass recorded yet — untiered until
              someone fills the figure in.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** Section card wrapper with a title and an empty-state fallback. */
function ChartCard({ title, hasData, children, height = 220 }) {
  return (
    <div className="rounded-card bg-card p-5 shadow-soft">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-faint">{title}</p>
      {hasData ? (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>{children}</ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[180px] items-center justify-center text-sm text-muted">
          No data yet
        </div>
      )}
    </div>
  )
}

export function LiveDonut({ byLive }) {
  const data = LIVE_META.map((s) => ({ ...s, value: byLive?.[s.key] ?? 0 })).filter(
    (d) => d.value > 0,
  )
  return (
    <ChartCard title="Connection status" hasData={data.length > 0}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={45} outerRadius={75} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} stroke="var(--card)" />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
      </PieChart>
    </ChartCard>
  )
}

/** Reused for buildings-by-operator and home-pass-by-operator. */
export function OperatorBar({ title, byOperator, dataKey, max = 8 }) {
  const data = [...(byOperator ?? [])]
    .sort((a, b) => (b[dataKey] ?? 0) - (a[dataKey] ?? 0))
    .slice(0, max)
    .map((row) => ({ name: row.name, value: row[dataKey] ?? 0 }))
  return (
    <ChartCard title={title} hasData={data.some((d) => d.value > 0)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={110} {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="value" fill="var(--fiber)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartCard>
  )
}

export function SurveysLine({ overTime }) {
  const data = overTime ?? []
  return (
    <ChartCard title="Surveys over time (30 days)" hasData={data.length > 0}>
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" {...axisProps} tick={{ fill: 'var(--muted)', fontSize: 10 }} minTickGap={24} />
        <YAxis {...axisProps} allowDecimals={false} width={28} />
        <Tooltip {...tooltipStyle} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--fiber)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartCard>
  )
}
