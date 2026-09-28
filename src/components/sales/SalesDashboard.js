'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { ROLE_LABELS } from '@/lib/roles'
import { VisitTimeline } from './VisitTimeline'
import { TeamPerformanceChart } from './DashboardCharts'

const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const daysAgo = (n) => startOfDay(new Date(Date.now() - n * 86400000))
const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last month' },
  { key: 'custom', label: 'Custom' },
]
const TIERS = [
  { value: 'SALES_MANAGER', label: 'Sales managers' },
  { value: 'TEAM_LEADER', label: 'Team leaders' },
  { value: 'SALES_EXECUTIVE', label: 'Sales executives' },
]
const EMPTY = []

function Tile({ label, value, accent }) {
  return (
    <div className="rounded-card border border-line bg-card px-4 py-3">
      <p className="text-2xl font-bold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      <p className="text-sm font-normal text-muted">{label}</p>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="rounded-card border border-line bg-card p-4">
      <p className="mb-3 text-sm font-medium text-ink">{title}</p>
      {children}
    </div>
  )
}

function avgDuration(visits) {
  const done = visits.filter((v) => v.checkOutAt)
  if (!done.length) return '—'
  const mins = done.reduce((s, v) => s + (new Date(v.checkOutAt) - new Date(v.visitedAt)) / 60000, 0) / done.length
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

/**
 * The team dashboard: a period + person filter, KPI tiles, two charts, and the
 * field-visit timeline — all scoped and filtered by the API.
 */
export function SalesDashboard() {
  const [range, setRange] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [tier, setTier] = useState('') // role tier: '' = all, or SALES_MANAGER/TEAM_LEADER/SALES_EXECUTIVE
  const [userId, setUserId] = useState('')
  const [team, setTeam] = useState([])
  const [data, setData] = useState(null)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  // The people you can filter to.
  useEffect(() => {
    let alive = true
    apiClient
      .get('/sales/team')
      .then((res) => alive && setTeam(res.data.data))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // The from/to window for the current range (stable per input).
  const window = useMemo(() => {
    if (range === 'today') return { from: startOfDay(new Date()).toISOString() }
    if (range === '7d') return { from: daysAgo(6).toISOString() }
    if (range === '30d') return { from: daysAgo(29).toISOString() }
    if (range === 'custom' && customFrom && customTo) {
      return { from: new Date(`${customFrom}T00:00:00`).toISOString(), to: new Date(`${customTo}T23:59:59`).toISOString() }
    }
    return null // custom, not both dates chosen yet
  }, [range, customFrom, customTo])

  useEffect(() => {
    if (!window) {
      setLoading(false)
      return undefined
    }
    let alive = true
    setLoading(true)
    // Fetch the whole scope for the period; the tier / person filters below are
    // applied on the client so switching between them is instant.
    Promise.all([apiClient.get('/sales/dashboard', { params: window }), apiClient.get('/sales/visits', { params: window })])
      .then(([d, v]) => {
        if (!alive) return
        setData(d.data.data)
        setVisits(v.data.data)
        setLoading(false)
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [window])

  const teamRows = data?.team ?? EMPTY
  const tierTeam = useMemo(() => teamRows.filter((u) => !tier || u.role === tier), [teamRows, tier])
  const shownTeam = useMemo(() => tierTeam.filter((u) => !userId || u.id === userId), [tierTeam, userId])
  const shownIds = useMemo(() => new Set(shownTeam.map((u) => u.id)), [shownTeam])
  const shownVisits = tier || userId ? visits.filter((v) => shownIds.has(v.user?.id)) : visits
  const sumVisits = shownTeam.reduce((s, u) => s + u.visits, 0)
  const sumInquiries = shownTeam.reduce((s, u) => s + u.inquiries, 0)

  return (
    <section className="mb-6 flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setRange(p.key)}
              className={`h-9 rounded-btn px-3 text-sm font-medium transition-colors ${
                range === p.key ? 'bg-fiber text-on-fiber' : 'border border-line text-muted hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-btn border border-line bg-card px-2 text-sm"
            />
            <span className="text-sm text-muted">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-btn border border-line bg-card px-2 text-sm"
            />
          </div>
        )}
        <select
          value={tier}
          onChange={(e) => {
            setTier(e.target.value)
            setUserId('')
          }}
          className="ml-auto h-9 rounded-btn border border-line bg-card px-3 text-sm font-medium"
        >
          <option value="">All roles</option>
          {TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="h-9 rounded-btn border border-line bg-card px-3 text-sm font-medium"
        >
          <option value="">{tier ? `All ${TIERS.find((t) => t.value === tier)?.label.toLowerCase()}` : 'Everyone'}</option>
          {tierTeam.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {ROLE_LABELS[u.role] ?? u.role}
            </option>
          ))}
        </select>
        {loading && <span className="loading loading-spinner loading-xs text-muted" />}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Buildings visited" value={sumVisits} accent="var(--color-fiber)" />
        <Tile label="Inquiries generated" value={sumInquiries} accent="var(--color-ok)" />
        <Tile label="Avg time / visit" value={avgDuration(shownVisits)} />
        <Tile label={userId ? 'Person' : 'People'} value={shownTeam.length} />
      </div>

      {/* Chart */}
      <Card title={tier ? `Visits by ${TIERS.find((t) => t.value === tier)?.label.toLowerCase()}` : 'Visits by person'}>
        <TeamPerformanceChart team={shownTeam} />
      </Card>

      <VisitTimeline visits={shownVisits} loading={loading} />
    </section>
  )
}
