'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { ROLE_LABELS } from '@/lib/roles'
import { VisitTimeline } from './VisitTimeline'

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
const PRESETS = [
  { key: 'today', label: 'Today', from: startOfToday },
  { key: 'week', label: 'Last 7 days', from: () => new Date(Date.now() - 7 * 86400000).toISOString() },
  { key: 'all', label: 'All time', from: () => null },
]

function Tile({ label, value }) {
  return (
    <div className="flex-1 rounded-card border border-line bg-card px-4 py-3">
      <p className="text-2xl font-bold tabular-nums text-ink">{value}</p>
      <p className="text-sm font-normal text-muted">{label}</p>
    </div>
  )
}

/**
 * Team activity for a manager / team leader: totals for the chosen period and a
 * per-person breakdown. Scoped and filtered entirely by the API.
 */
export function SalesDashboard() {
  const [preset, setPreset] = useState('today')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  // Stable per preset, so the timeline below does not refetch every render.
  const from = useMemo(() => PRESETS.find((p) => p.key === preset).from(), [preset])

  useEffect(() => {
    let alive = true
    setLoading(true)
    apiClient
      .get('/sales/dashboard', { params: from ? { from } : {} })
      .then((res) => alive && (setData(res.data.data), setLoading(false)))
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [from])

  const totals = data?.totals ?? { visits: 0, inquiries: 0 }
  const team = data?.team ?? []

  return (
    <section className="mb-6 flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`h-8 rounded-btn px-3 text-sm font-medium transition-colors ${
              preset === p.key ? 'bg-fiber text-on-fiber' : 'border border-line text-muted hover:text-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
        {loading && <span className="loading loading-spinner loading-xs ml-1 text-muted" />}
      </div>

      <div className="flex gap-3">
        <Tile label="Buildings visited" value={totals.visits} />
        <Tile label="Inquiries generated" value={totals.inquiries} />
        <Tile label="Team members" value={team.length} />
      </div>

      {team.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Team member</th>
                <th className="px-4 py-2 text-right font-medium">Visits</th>
                <th className="px-4 py-2 text-right font-medium">Inquiries</th>
              </tr>
            </thead>
            <tbody>
              {team.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    {u.name} <span className="text-muted">· {ROLE_LABELS[u.role] ?? u.role}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{u.visits}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{u.inquiries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VisitTimeline from={from} />
    </section>
  )
}
