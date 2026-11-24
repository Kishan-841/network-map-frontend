'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { ROLE_LABELS } from '@/lib/roles'
import {
  committedDate, countsOf, filterOptions, filterRows, istToday, peopleList, planQuery, readPlanQuery, rowStatus, shownSummary,
  todayCards, visitLink, windowLabel,
} from '@/lib/sales-today'
import { useClientTable } from '@/hooks/useClientTable'
import { Input, Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'

const FOCUS_THROTTLE_MS = 30_000
const clock = () => Date.now() // read only in effects / event handlers
const TONE = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', muted: 'text-muted' }
const DOT = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', muted: 'bg-faint' }
const searchText = (r) => [r.building.buildingName, r.building.formattedAddress, r.assignee.name]

function Status({ row }) {
  const s = rowStatus(row)
  return (
    <span className="inline-flex flex-col">
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium ${TONE[s.tone]}`}>
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

// Visited / visiting rows open the visit (a companion visit opens the visit they came along on);
// `back` is the plan's address, so the visit page's back arrow returns to this day and these filters.
const makeColumns = (back) => {
  const visitHref = (r) => visitLink(r.visit.id, back)
  return [
  {
    key: 'building',
    header: 'Building',
    render: (r) => (
      <div className="min-w-0 max-w-[12rem] sm:max-w-[18rem] lg:max-w-[22rem]">
        {r.visit ? (
          <Link href={visitHref(r)} className="block truncate font-medium text-fiber hover:underline">
            {r.building.buildingName}
          </Link>
        ) : (
          <p className="truncate font-medium text-ink">{r.building.buildingName}</p>
        )}
        <p className="truncate text-sm font-normal text-muted">{r.building.formattedAddress}</p>
      </div>
    ),
  },
  { key: 'homePass', header: 'Home pass', className: 'tabular-nums', render: (r) => r.building.homePass ?? '—' },
  { key: 'assignee', header: 'Assigned to', render: (r) => who(r.assignee) },
  { key: 'window', header: 'Time', className: 'tabular-nums whitespace-nowrap', render: windowLabel },
  {
    key: 'status',
    header: 'Status',
    render: (r) =>
      r.visit ? (
        <Link href={visitHref(r)} aria-label={`Open the visit to ${r.building.buildingName}`} className="hover:opacity-80">
          <Status row={r} />
        </Link>
      ) : (
        <Status row={r} />
      ),
  },
  ]
}

function cardFor(r, back) {
  return r.visit ? <Link href={visitLink(r.visit.id, back)} className="block">{cardBody(r)}</Link> : cardBody(r)
}

const cardBody = (r) => (
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

/** One day's rows. Remounted (key) per day + person, so search and page start fresh. */
function PlanTable({ rows, loading, forPerson, back }) {
  const table = useClientTable(rows, { getSearchText: searchText })
  return (
    <>
      <SearchInput
        value={table.search}
        onChange={table.onSearchChange}
        placeholder="Search by building, address or person…"
        className="mb-4"
      />
      <DataTable
        columns={makeColumns(back)}
        rows={table.rows}
        loading={loading}
        keyField="id"
        renderCard={(r) => cardFor(r, back)}
        emptyState={
          <p className="text-sm font-normal text-muted">
            {forPerson ? 'Nothing planned for this person on this day.' : 'Nothing planned for this day. Upload a plan from Team plan.'}
          </p>
        }
      />
      <Pagination pagination={table.pagination} onChange={table.onPageChange} />
    </>
  )
}

/** One person in the Checked in panel: initials, name, role + how much of the day's plan they visited, time. */
function PersonRow({ p }) {
  const checked = Boolean(p.time)
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          checked ? 'bg-ok-tint text-ok' : 'bg-bad-tint text-bad'
        }`}
      >
        {p.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{p.name}</p>
        <p className="truncate text-xs font-normal text-muted">
          {ROLE_LABELS[p.role] ?? p.role}
          {p.planned > 0 ? ` · ${p.visited} of ${p.planned} visited` : ' · nothing planned'}
        </p>
      </div>
      {checked ? (
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-ink">{p.time}</span>
          <span className="block text-[11px] font-normal text-muted">first check-in</span>
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-bad-tint px-2.5 py-1 text-xs font-medium text-bad">Not yet</span>
      )}
    </li>
  )
}

/** Everyone in scope for the day: a summary bar, then who checked in (by time) and who has not. */
function PeopleChecked({ people, rows }) {
  const list = peopleList(people, rows)
  const done = list.filter((p) => p.time)
  const notYet = list.filter((p) => !p.time)
  const pct = list.length ? Math.round((done.length / list.length) * 100) : 0
  const group = (title, items) =>
    items.length > 0 && (
      <section className="mt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {title} <span className="ml-1 font-normal">{items.length}</span>
        </h3>
        <ul className="divide-y divide-line">
          {items.map((p) => (
            <PersonRow key={p.id} p={p} />
          ))}
        </ul>
      </section>
    )
  return (
    <div>
      <div className="rounded-card bg-paper p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-2xl font-semibold tabular-nums text-ink">
            {done.length} <span className="text-base font-normal text-muted">of {list.length} checked in</span>
          </p>
          <p className="text-sm font-medium tabular-nums text-muted">{pct}%</p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={done.length}
          aria-valuemin={0}
          aria-valuemax={list.length}
          aria-label="Checked in"
        >
          <div className="h-full rounded-full bg-ok transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {group('Checked in', done)}
      {group('Not checked in yet', notYet)}
    </div>
  )
}

const fmtDay = (day) =>
  new Date(`${day}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })

/**
 * ADMIN / SALES_MANAGER: one day of the uploaded visit plan (spec 2026-11-24-sales-day-plan).
 * Date (default today, IST) + sales-user filter drive four cards and the list of plan rows.
 * Refetches on any filter change and when the tab regains focus (30 s throttle).
 */
export function DayPlan() {
  // Date, person and filters live in the address (lib/sales-today planQuery), so Back from
  // a visit page returns to the same view. Filter changes replace the entry, not push.
  const router = useRouter()
  const today = istToday()
  const state = readPlanQuery(useSearchParams(), today)
  const { date, userId } = state
  const place = { operatorId: state.operatorId, zoneId: state.zoneId, city: state.city, phase: state.phase }
  const hrefFor = (s) => {
    const qs = planQuery(s, today)
    return qs ? `/sales?${qs}` : '/sales'
  }
  const update = (patch) => router.replace(hrefFor({ ...state, ...patch }), { scroll: false })
  // A half-typed day in the date box, kept only while the address still shows the day it was typed on;
  // once the day changes (a whole date typed, or Back) the box shows the address's day.
  const [draft, setDraft] = useState({ on: null, value: '' })
  const dateBox = draft.on === date ? draft.value : date
  const [people, setPeople] = useState({ list: [], error: null })
  const [tick, setTick] = useState(0)
  const [peopleOpen, setPeopleOpen] = useState(false)
  // The last answer, tagged with the request (key) and the filters (filterKey) it answers:
  // "loading" is derived, a late answer to an old filter is dropped (alive flag), and a
  // failed request never leaves another day's or person's numbers on screen.
  const [result, setResult] = useState({ key: null, filterKey: null, summary: null, error: null })
  const lastFetch = useRef(0)
  const filterKey = `${date}|${userId}`
  const key = `${filterKey}|${tick}`

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
    lastFetch.current = clock()
    apiClient
      .get('/sales/tasks/today-summary', { params: { date, ...(userId ? { userId } : {}) } })
      .then((res) => alive && setResult({ key, filterKey, summary: res.data.data, error: null }))
      .catch((err) => alive && setResult((prev) => ({ ...prev, key, error: getApiErrorMessage(err, "Could not load this day's plan") })))
    return () => {
      alive = false
    }
  }, [key, filterKey, date, userId])

  useEffect(() => {
    const onFocus = () => {
      if (clock() - lastFetch.current > FOCUS_THROTTLE_MS) setTick((t) => t + 1)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const loading = result.key !== key
  // Shown only when it answers these filters; a focus refresh keeps it on screen, dimmed.
  const shown = shownSummary(result, filterKey)
  const options = filterOptions(shown?.rows ?? [])
  // A place picked on another day that isn't in this day's plan falls back to "All".
  const active = {
    operatorId: options.operators.some((o) => o.id === place.operatorId) ? place.operatorId : '',
    zoneId: options.zones.some((z) => z.id === place.zoneId) ? place.zoneId : '',
    city: options.cities.includes(place.city) ? place.city : '',
    phase: place.phase,
  }
  const activeKey = Object.values(active).join('|')
  const filtered = filterRows(shown?.rows ?? [], active)
  // Building filters narrow Planned / Done / Not visited; Checked in (people) follows only the user filter.
  const cards = shown ? todayCards({ ...shown, ...countsOf(filtered) }) : null
  const setFilter = (k) => (e) => update({ [k]: e.target.value })
  const failed = Boolean(result.error) && !loading
  const isToday = date === today

  return (
    <section aria-label="Day plan">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Input
          id="f-plan-date"
          type="date"
          aria-label="Day"
          value={dateBox}
          onChange={(e) => {
            setDraft({ on: date, value: e.target.value })
            const day = committedDate(e.target.value)
            if (day && day !== date) update({ date: day })
          }}
        />
        <Select id="f-sales-user" aria-label="Sales user" value={userId} onChange={(e) => update({ userId: e.target.value })}>
          <option value="">All sales users</option>
          {people.list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {ROLE_LABELS[p.role] ?? p.role}
            </option>
          ))}
        </Select>
      </div>
      {people.error && <p className="-mt-2 mb-3 text-sm font-normal text-muted">{people.error}</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Select id="f-plan-operator" aria-label="Operator" value={active.operatorId} onChange={setFilter('operatorId')}>
          <option value="">All operators</option>
          {options.operators.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
        <Select id="f-plan-zone" aria-label="Zone" value={active.zoneId} onChange={setFilter('zoneId')}>
          <option value="">All zones</option>
          {options.zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </Select>
        <Select id="f-plan-city" aria-label="City" value={active.city} onChange={setFilter('city')}>
          <option value="">All cities</option>
          {options.cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select id="f-plan-phase" aria-label="Visit status" value={active.phase} onChange={setFilter('phase')}>
          <option value="">All statuses</option>
          <option value="visited">Visited</option>
          <option value="visiting">Visiting</option>
          <option value="not_visited">Not visited</option>
        </Select>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-ink">
        {isToday ? 'Today' : 'Plan for'} <span className="ml-1 font-normal text-muted">{fmtDay(date)}</span>
      </h2>

      <div className={`mb-2 grid grid-cols-2 gap-3 lg:grid-cols-4 ${loading && cards ? 'opacity-60' : ''}`} aria-busy={loading}>
        {cards
          ? cards.map((c) => {
              const body = (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{c.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{c.value}</p>
                  <p className="text-sm font-normal text-muted">{c.key === 'checkedIn' && !shown.user ? 'tap to see who' : c.sub}</p>
                </>
              )
              return c.key === 'checkedIn' ? (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setPeopleOpen(true)}
                  className="rounded-card border border-line bg-card p-4 text-left shadow-soft transition-colors hover:border-fiber/40"
                >
                  {body}
                </button>
              ) : (
                <div key={c.key} className="rounded-card border border-line bg-card p-4 shadow-soft">
                  {body}
                </div>
              )
            })
          : [0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-[6.25rem] rounded-card bg-paper ${failed ? '' : 'animate-pulse'}`} />
            ))}
      </div>
      {failed ? (
        <p className="mb-3 text-sm font-normal text-bad">
          {result.error}{' '}
          <button type="button" className="font-medium text-ink underline" onClick={() => setTick((t) => t + 1)}>
            Try again
          </button>
        </p>
      ) : (
        <div className="mb-3" />
      )}

      <div className={loading && shown ? 'opacity-60' : ''}>
        <PlanTable key={`${filterKey}|${activeKey}`} rows={filtered} loading={!shown && !failed} forPerson={Boolean(userId)} back={hrefFor(state)} />
      </div>

      <Modal open={peopleOpen && Boolean(shown)} onClose={() => setPeopleOpen(false)} title={`Who checked in · ${fmtDay(date)}`}>
        {shown && <PeopleChecked people={shown.people ?? []} rows={shown.rows ?? []} />}
      </Modal>
    </section>
  )
}
