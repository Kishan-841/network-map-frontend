'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { ROLE_LABELS } from '@/lib/roles'
import { VisitTimeline } from './VisitTimeline'

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

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

function PersonDetails({ person, visits }) {
  if (!person) return <p className="text-sm font-normal text-muted">No data for this person in this period.</p>
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-fiber) 12%, transparent)', color: 'var(--color-fiber)' }}
        >
          {initials(person.name)}
        </div>
        <div>
          <p className="font-medium text-ink">{person.name}</p>
          <p className="text-sm font-normal text-muted">{ROLE_LABELS[person.role] ?? person.role}</p>
        </div>
      </div>

      <div className="ml-auto flex items-end gap-6">
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--color-ok)' }}>
            {person.inquiries}
          </p>
          <p className="text-sm font-normal text-muted">Inquiries</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums text-ink">{person.visits}</p>
          <p className="text-sm font-normal text-muted">Visits</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums text-ink">{avgDuration(visits)}</p>
          <p className="text-sm font-normal text-muted">Avg / visit</p>
        </div>
      </div>
    </div>
  )
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
          <option value="">All</option>
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
          <option value="">Overall</option>
          {tierTeam.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {ROLE_LABELS[u.role] ?? u.role}
            </option>
          ))}
        </select>
        {loading && <span className="loading loading-spinner loading-xs text-muted" />}
      </div>

      {/* KPI tiles */}
      <div className={`grid grid-cols-2 gap-3 ${userId ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
        <Tile label="Buildings visited" value={sumVisits} accent="var(--color-fiber)" />
        <Tile label="Inquiries generated" value={sumInquiries} accent="var(--color-ok)" />
        <Tile label="Avg time / visit" value={avgDuration(shownVisits)} />
        {!userId && <Tile label="People" value={shownTeam.length} />}
      </div>

      {/* Chart / details */}
      {userId ? (
        <Card title="Details for selected person">
          <PersonDetails person={shownTeam[0]} visits={shownVisits} />
        </Card>
      ) : (
        <Card title="Overall details">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Total visits</span>
              <span className="font-medium tabular-nums">{sumVisits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Total inquiries</span>
              <span className="font-medium tabular-nums">{sumInquiries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">People in scope</span>
              <span className="font-medium tabular-nums">{shownTeam.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Avg time / visit</span>
              <span className="font-medium tabular-nums">{avgDuration(shownVisits)}</span>
            </div>
          </div>
        </Card>
      )}

      <VisitTimeline visits={shownVisits} loading={loading} />
    </section>
  )
}
