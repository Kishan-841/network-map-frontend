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
import { designationLabel } from '@/lib/roles'
import { ChartCard, TrendChart, BarList, fillDays } from '@/components/acquisition/Charts'

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

function Kpi({ label, value, sub, delta }) {
  // Delta is period-over-period; arrow + sign carry the meaning, colour only
  // reinforces it (never colour alone).
  const up = delta > 0
  const down = delta < 0
  return (
    <div className="rounded-card bg-card p-4 shadow-soft">
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {delta != null && delta !== 0 && (
          <span
            className={`text-xs font-medium tabular-nums ${up ? 'text-ok' : 'text-bad'}`}
            title="vs the previous period of the same length"
          >
            {up ? '▲' : down ? '▼' : ''} {Math.abs(delta)}
          </span>
        )}
      </div>
      <p className="text-sm font-medium">{label}</p>
      {sub && <p className="text-xs font-normal text-muted">{sub}</p>}
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

  // Zero-filled so quiet days read as "no work", not missing data.
  const trendPoints = useMemo(
    () => fillDays(stats?.trend ?? [], range.from, range.to),
    [stats, range.from, range.to],
  )
  const activeInRange = stats ? stats.agents.filter((a) => a.buildings > 0).length : null
  const idleAgents = (stats?.agents ?? []).filter((a) => a.buildings === 0 && a.isActive)

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

      {/* Headline numbers */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Buildings logged"
          value={stats?.totalInRange ?? '—'}
          sub="in selected range"
          delta={
            stats?.previousRangeTotal != null
              ? stats.totalInRange - stats.previousRangeTotal
              : null
          }
        />
        <Kpi
          label="Home pass reached"
          value={stats?.homePassReached ?? '—'}
          sub="flats across those buildings"
        />
        <Kpi label="Contacts captured" value={stats?.contactsCaptured ?? '—'} sub="decision-makers met" />
        <Kpi
          label="Agents active"
          value={activeInRange == null ? '—' : `${activeInRange}/${stats?.agents?.length ?? 0}`}
          sub="logged in this range"
        />
      </div>

      {/* Trend */}
      <div className="mb-4">
        <ChartCard
          title="Buildings logged per day"
          subtitle={`${range.from} → ${range.to}`}
          empty={trendPoints.length === 0 ? 'No data for this range.' : null}
        >
          <TrendChart points={trendPoints} />
        </ChartCard>
      </div>

      {/* Leaderboard + who they meet */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Buildings by agent" subtitle="Who is logging the most">
          <BarList
            rows={(stats?.agents ?? [])
              .map((a) => ({ id: a.id, label: a.name, value: a.buildings }))
              .sort((x, y) => y.value - x.value)}
            emptyLabel="No agents yet."
          />
        </ChartCard>

        <ChartCard
          title="Who agents are meeting"
          subtitle="Designation of the contact person"
        >
          <BarList
            rows={(stats?.byDesignation ?? []).map((d) => ({
              id: d.designation,
              label: designationLabel(d.designation),
              value: d.count,
            }))}
            emptyLabel="No contacts captured in this range."
          />
        </ChartCard>
      </div>

      {/* Pincode coverage + agents needing attention */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Pincode coverage" subtitle="Where the work is happening">
          <BarList
            rows={(stats?.byPincode ?? []).map((p) => ({
              id: p.pincode,
              label: p.pincode,
              value: p.count,
            }))}
            emptyLabel="No buildings logged in this range."
          />
        </ChartCard>

        <ChartCard
          title="Needs attention"
          subtitle="Agents with nothing logged in this range"
        >
          {idleAgents.length === 0 ? (
            <p className="py-4 text-sm font-normal text-muted">
              Every agent logged at least one building. 🎉
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {idleAgents.slice(0, 6).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-btn bg-paper px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {a.pincodes.join(', ') || 'No pincodes assigned'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {a.lastActivity
                      ? `last ${new Date(a.lastActivity).toLocaleDateString('en-IN')}`
                      : 'never logged'}
                  </span>
                </li>
              ))}
              {idleAgents.length > 6 && (
                <li className="pt-1 text-xs font-normal text-muted">
                  +{idleAgents.length - 6} more
                </li>
              )}
            </ul>
          )}
        </ChartCard>
      </div>

      {addOpen && (
        <NewAgentModal onClose={() => setAddOpen(false)} onCreated={() => setTick((t) => t + 1)} />
      )}
    </main>
  )
}
