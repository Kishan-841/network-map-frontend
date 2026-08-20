'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useCities } from '@/hooks/useCities'
import { useAuthStore } from '@/stores/auth-store'
import { IconPlus, IconUser } from '@/components/ui/icons'

const iso = (d) => d.toISOString().slice(0, 10)
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return iso(d)
}

const RANGES = [
  { key: 'today', label: 'Today', from: () => iso(new Date()), to: () => iso(new Date()) },
  { key: 'yesterday', label: 'Yesterday', from: () => daysAgo(1), to: () => daysAgo(1) },
  { key: '7d', label: 'Last 7 days', from: () => daysAgo(6), to: () => iso(new Date()) },
  { key: '30d', label: 'Last 30 days', from: () => daysAgo(29), to: () => iso(new Date()) },
  { key: 'custom', label: 'Custom', from: null, to: null },
]

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-card bg-card p-4 shadow-soft">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      {sub && <p className="text-xs font-normal text-muted">{sub}</p>}
    </div>
  )
}

/** Simple inline bar chart — avoids pulling a chart library for one view. */
function Trend({ points }) {
  if (!points?.length) {
    return <p className="text-sm font-normal text-muted">No buildings logged in this range.</p>
  }
  const max = Math.max(...points.map((p) => p.count))
  return (
    <div className="flex h-32 items-end gap-1 overflow-x-auto">
      {points.map((p) => (
        <div key={p.date} className="flex min-w-6 flex-1 flex-col items-center gap-1" title={`${p.date}: ${p.count}`}>
          <div
            className="w-full rounded-t bg-fiber"
            style={{ height: `${Math.max(4, (p.count / max) * 100)}%` }}
          />
          <span className="text-[9px] tabular-nums text-faint">{p.date.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}

function NewAgentModal({ onClose, onCreated }) {
  const { cities } = useCities()
  const [form, setForm] = useState({ name: '', email: '', password: '', cityId: '', pincodes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const pincodeList = form.pincodes
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const valid =
    form.name.trim() &&
    form.email.trim() &&
    form.password.length >= 8 &&
    form.cityId &&
    pincodeList.length > 0 &&
    pincodeList.every((p) => /^[1-9][0-9]{5}$/.test(p))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post('/users', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: 'ACQUISITION_AGENT',
        cityId: form.cityId,
        pincodes: pincodeList,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the agent'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add acquisition agent"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" loading={busy} disabled={!valid} onClick={save}>
            Create agent
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          id="agent-name"
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          id="agent-email"
          label="Email"
          inputMode="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          id="agent-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <p className="-mt-1 text-xs font-normal text-muted">
          At least 8 characters, with a letter and a number.
        </p>
        <Select
          id="agent-city"
          label="City"
          value={form.cityId}
          onChange={(e) => setForm({ ...form, cityId: e.target.value })}
        >
          <option value="">Select city…</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          id="agent-pincodes"
          label="Pincodes"
          placeholder="411014, 411057"
          value={form.pincodes}
          onChange={(e) => setForm({ ...form, pincodes: e.target.value })}
        />
        <p className="-mt-1 text-xs font-normal text-muted">
          Comma-separated 6-digit PIN codes the agent covers.
        </p>
        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}
      </div>
    </Modal>
  )
}

export default function AcquisitionPage() {
  const role = useAuthStore((s) => s.user?.role)
  const [rangeKey, setRangeKey] = useState('7d')
  const [custom, setCustom] = useState({ from: daysAgo(6), to: iso(new Date()) })
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [tick, setTick] = useState(0)

  const range = useMemo(() => {
    const preset = RANGES.find((r) => r.key === rangeKey)
    return preset?.from ? { from: preset.from(), to: preset.to() } : custom
  }, [rangeKey, custom])

  const load = useCallback(() => {
    apiClient
      .get('/stats/acquisition', { params: { dateFrom: range.from, dateTo: range.to } })
      .then((res) => setStats(res.data.data))
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load team stats')))
  }, [range.from, range.to])

  useEffect(() => {
    load()
  }, [load, tick])

  return (
    <main className="stagger mx-auto max-w-4xl">
      <PageHeader
        title="Acquisition team"
        sub="Daily output per agent"
        action={
          <Button onClick={() => setAddOpen(true)}>
            <IconPlus className="h-4.5 w-4.5" />
            Add agent
          </Button>
        }
      />

      {/* Date range */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRangeKey(r.key)}
            aria-pressed={rangeKey === r.key}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              rangeKey === r.key
                ? 'border-fiber bg-fiber text-white'
                : 'border-line bg-card text-muted hover:text-ink'
            }`}
          >
            {r.label}
          </button>
        ))}
        {rangeKey === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={custom.from}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              className="h-10 rounded-btn border border-line bg-card px-3 text-sm"
            />
            <span className="text-xs text-muted">to</span>
            <input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              className="h-10 rounded-btn border border-line bg-card px-3 text-sm"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="In selected range" value={stats?.totalInRange ?? '—'} />
        <Kpi label="Today" value={stats?.today ?? '—'} />
        <Kpi label="Contacts captured" value={stats?.contactsCaptured ?? '—'} sub="in range" />
        <Kpi label="Active agents" value={stats?.activeAgents ?? '—'} />
      </div>

      {/* Trend */}
      <section className="mb-5 rounded-card bg-card p-4 shadow-soft">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-faint">
          Buildings logged per day
        </p>
        <Trend points={stats?.trend} />
      </section>

      {/* Per-agent table */}
      <section className="rounded-card bg-card p-4 shadow-soft">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-faint">Agents</p>
        {stats?.agents?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-faint">
                <tr>
                  <th className="py-2">Agent</th>
                  <th className="py-2">Pincodes</th>
                  <th className="py-2 pr-6 text-right">Buildings</th>
                  <th className="py-2">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {stats.agents.map((a) => (
                  <tr key={a.id} className="border-t border-line/60">
                    <td className="py-2.5">
                      <Link
                        href={`/buildings?createdById=${a.id}`}
                        className="flex items-center gap-2 font-medium hover:text-fiber"
                      >
                        <IconUser className="h-4 w-4 text-faint" strokeWidth={1.8} />
                        <span className="min-w-0">
                          <span className="block truncate">{a.name}</span>
                          <span className="block truncate text-xs font-normal text-muted">
                            {a.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-2.5 text-xs text-muted">{a.pincodes.join(', ') || '—'}</td>
                    <td className="py-2.5 pr-6 text-right font-bold tabular-nums">{a.buildings}</td>
                    <td className="py-2.5 text-xs text-muted">
                      {a.lastActivity ? new Date(a.lastActivity).toLocaleString('en-IN') : '—'}
                      {!a.isActive && <span className="ml-2 text-bad">inactive</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm font-normal text-muted">
            No agents yet — add your first one to start tracking.
          </p>
        )}
      </section>

      {addOpen && (
        <NewAgentModal onClose={() => setAddOpen(false)} onCreated={() => setTick((t) => t + 1)} />
      )}
    </main>
  )
}
