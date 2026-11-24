'use client'

import { useEffect, useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { ROLE_LABELS } from '@/lib/roles'
import { istToday, rowStatus, todayCards, windowLabel } from '@/lib/sales-today'
import { useClientTable } from '@/hooks/useClientTable'
import { Input, Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'

const FOCUS_THROTTLE_MS = 30_000
const TONE = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', muted: 'text-muted' }
const DOT = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', muted: 'bg-faint' }
const searchText = (r) => [r.building.buildingName, r.building.formattedAddress, r.assignee.name]

function Status({ row }) {
  const s = rowStatus(row)
  return (
    <span className="inline-flex flex-col">
      <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${TONE[s.tone]}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${DOT[s.tone]}`} />
        {s.label}
      </span>
      {s.detail && <span className="text-xs font-normal text-muted">{s.detail}</span>}
    </span>
  )
}

const who = (a) => (
  <span className="text-sm font-normal">
    {a.name} <span className="text-muted">· {ROLE_LABELS[a.role] ?? a.role}</span>
  </span>
)

const columns = [
  {
    key: 'building',
    header: 'Building',
    render: (r) => (
      <div className="min-w-0 max-w-[12rem] sm:max-w-[18rem] lg:max-w-[22rem]">
        <p className="truncate font-medium text-ink">{r.building.buildingName}</p>
        <p className="truncate text-sm font-normal text-muted">{r.building.formattedAddress}</p>
      </div>
    ),
  },
  { key: 'homePass', header: 'Home pass', className: 'tabular-nums', render: (r) => r.building.homePass ?? '—' },
  { key: 'assignee', header: 'Assigned to', render: (r) => who(r.assignee) },
  { key: 'window', header: 'Time', className: 'tabular-nums whitespace-nowrap', render: windowLabel },
  { key: 'status', header: 'Status', render: (r) => <Status row={r} /> },
]

const renderCard = (r) => (
  <div className="rounded-card border border-line bg-card p-3 shadow-soft">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{r.building.buildingName}</p>
        <p className="truncate text-sm font-normal text-muted">{r.building.formattedAddress}</p>
      </div>
      <Status row={r} />
    </div>
    <p className="mt-1 text-sm font-normal text-muted">
      {r.assignee.name} · {windowLabel(r)}
      {r.building.homePass != null ? ` · ${r.building.homePass} home pass` : ''}
    </p>
  </div>
)

const fmtDay = (day) =>
  new Date(`${day}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })

/**
 * ADMIN / SALES_MANAGER: one day of the uploaded visit plan (spec 2026-11-24-sales-day-plan).
 * Date (default today, IST) + sales-user filter drive four cards and the list of plan rows.
 * Refetches on any filter change and when the tab regains focus (30 s throttle).
 */
export function DayPlan() {
  const [date, setDate] = useState(() => istToday())
  const [people, setPeople] = useState({ list: [], error: null })
  const [userId, setUserId] = useState('')
  const [tick, setTick] = useState(0)
  // The last answer, tagged with the request it answers: "loading" is derived, and a
  // late answer to an old filter can never overwrite the current one (alive flag).
  const [result, setResult] = useState({ key: null, summary: null, error: null })
  const lastFetch = useRef(0)
  const key = `${date}|${userId}|${tick}`

  useEffect(() => {
    let alive = true
    apiClient
      .get('/sales/tasks/assignees')
      .then((res) => alive && setPeople({ list: res.data.data ?? [], error: null }))
      .catch(() => alive && setPeople({ list: [], error: 'Could not load the sales users' }))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    lastFetch.current = Date.now()
    apiClient
      .get('/sales/tasks/today-summary', { params: { date, ...(userId ? { userId } : {}) } })
      .then((res) => alive && setResult({ key, summary: res.data.data, error: null }))
      .catch((err) => alive && setResult((prev) => ({ key, summary: prev.summary, error: getApiErrorMessage(err, "Could not load this day's plan") })))
    return () => {
      alive = false
    }
  }, [key, date, userId])

  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastFetch.current > FOCUS_THROTTLE_MS) setTick((t) => t + 1)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const loading = result.key !== key
  // Rows of the shown answer only once it matches the filters (no old day's rows under a new date).
  const current = !loading && result.summary?.date === date ? result.summary : null
  const table = useClientTable(current?.rows ?? [], { getSearchText: searchText })
  const cards = result.summary ? todayCards(result.summary) : null
  const isToday = date === istToday()

  return (
    <section aria-label="Day plan">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Input
          id="f-plan-date"
          type="date"
          aria-label="Day"
          value={date}
          onChange={(e) => setDate(e.target.value || istToday())}
        />
        <Select id="f-sales-user" aria-label="Sales user" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">All sales users</option>
          {people.list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {ROLE_LABELS[p.role] ?? p.role}
            </option>
          ))}
        </Select>
      </div>
      {people.error && <p className="-mt-2 mb-3 text-sm font-normal text-muted">{people.error}</p>}

      <h2 className="mb-3 text-sm font-semibold text-ink">
        {isToday ? 'Today' : 'Plan for'} <span className="ml-1 font-normal text-muted">{fmtDay(date)}</span>
      </h2>

      <div className={`mb-2 grid grid-cols-2 gap-3 lg:grid-cols-4 ${loading && cards ? 'opacity-60' : ''}`} aria-busy={loading}>
        {cards
          ? cards.map((c) => (
              <div key={c.key} className="rounded-card border border-line bg-card p-4 shadow-soft">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{c.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{c.value}</p>
                <p className="text-sm font-normal text-muted">{c.sub}</p>
              </div>
            ))
          : [0, 1, 2, 3].map((i) => <div key={i} className="h-[6.25rem] animate-pulse rounded-card bg-paper" />)}
      </div>
      {result.error && !loading ? (
        <p className="mb-3 text-sm font-normal text-bad">
          {result.error}{' '}
          <button type="button" className="font-medium text-ink underline" onClick={() => setTick((t) => t + 1)}>
            Try again
          </button>
        </p>
      ) : (
        <div className="mb-3" />
      )}

      <SearchInput
        value={table.search}
        onChange={table.onSearchChange}
        placeholder="Search by building, address or person…"
        className="mb-4"
      />
      <DataTable
        columns={columns}
        rows={table.rows}
        loading={loading && !current}
        keyField="id"
        renderCard={renderCard}
        emptyState={
          <p className="text-sm font-normal text-muted">
            {userId ? 'Nothing planned for this person on this day.' : 'Nothing planned for this day. Upload a plan from Team plan.'}
          </p>
        }
      />
      <Pagination pagination={table.pagination} onChange={table.onPageChange} />
    </section>
  )
}
