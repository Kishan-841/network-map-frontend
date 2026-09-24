'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'
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

function avgDuration(visits) {
  const done = visits.filter((v) => v.checkOutAt)
  if (!done.length) return '—'
  const mins = done.reduce((s, v) => s + (new Date(v.checkOutAt) - new Date(v.visitedAt)) / 60000, 0) / done.length
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

/**
 * A sales executive's own field work: a period filter, KPI tiles, the activity
 * mix, and the list of their visits. Everything is computed from their own
 * `GET /sales/visits` (the API already scopes an executive to themselves), so
 * there is no team data here — just their performance.
 */
export function MyPerformance() {
  const [range, setRange] = useState('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

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
    apiClient
      .get('/sales/visits', { params: window })
      .then((res) => {
        if (!alive) return
        setVisits(res.data.data)
        setLoading(false)
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [window])

  const totals = useMemo(() => {
    const inquiries = visits.reduce((s, v) => s + (v.inquiries?.length ?? 0), 0)
    const activities = visits.reduce((s, v) => s + (v.activities?.length ?? 0), 0)
    return { visits: visits.length, inquiries, activities }
  }, [visits])

  return (
    <section className="mb-6 flex flex-col gap-4">
      {/* Period filter */}
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
        {loading && <span className="loading loading-spinner loading-xs text-muted" />}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Buildings visited" value={totals.visits} accent="var(--color-fiber)" />
        <Tile label="Inquiries generated" value={totals.inquiries} accent="var(--color-ok)" />
        <Tile label="Activities logged" value={totals.activities} />
        <Tile label="Avg time / visit" value={avgDuration(visits)} />
      </div>

      <VisitTimeline visits={visits} loading={loading} showPerson={false} />
    </section>
  )
}
