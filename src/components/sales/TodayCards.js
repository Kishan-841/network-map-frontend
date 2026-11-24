'use client'

import { useEffect, useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { ROLE_LABELS } from '@/lib/roles'
import { todayCards } from '@/lib/sales-today'
import { Select } from '@/components/ui/Input'

const FOCUS_THROTTLE_MS = 30_000

/**
 * Today at a glance for ADMIN / SALES_MANAGER (spec 2026-11-24-sales-today-cards):
 * a sales-user filter and four cards — Planned today, Done, Held, Checked in.
 * The filter changes the cards only; the registry below is untouched.
 * Refetches on filter change and when the tab regains focus (30 s throttle).
 */
export function TodayCards() {
  const [people, setPeople] = useState([])
  const [userId, setUserId] = useState('')
  const [tick, setTick] = useState(0)
  // The last answer, tagged with the request it answers, so "loading" is derived
  // (no setState at the start of the effect).
  const [result, setResult] = useState({ key: null, summary: null, error: null })
  const lastFetch = useRef(0)
  const key = `${userId}|${tick}`

  useEffect(() => {
    let alive = true
    apiClient
      .get('/sales/tasks/assignees')
      .then((res) => alive && setPeople(res.data.data ?? []))
      .catch(() => alive && setPeople([]))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    lastFetch.current = Date.now()
    apiClient
      .get('/sales/tasks/today-summary', { params: userId ? { userId } : {} })
      .then((res) => alive && setResult({ key, summary: res.data.data, error: null }))
      .catch((err) => alive && setResult({ key, summary: null, error: getApiErrorMessage(err, "Could not load today's numbers") }))
    return () => {
      alive = false
    }
  }, [key, userId])

  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastFetch.current > FOCUS_THROTTLE_MS) setTick((t) => t + 1)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Keep showing the previous numbers while a refresh is in flight; skeleton only on first load.
  const loading = result.key !== key
  const cards = result.summary ? todayCards(result.summary) : null

  return (
    <section aria-label="Today" className="mb-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">
          Today
          {result.summary?.date && <span className="ml-1.5 font-normal text-muted">{fmtDate(result.summary.date)}</span>}
        </h2>
        <div className="w-full sm:w-64">
          <Select id="f-sales-user" aria-label="Sales user" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">All sales users</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {ROLE_LABELS[p.role] ?? p.role}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {result.error && !loading ? (
        <p className="text-sm font-normal text-muted">{result.error}</p>
      ) : (
        <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${loading && cards ? 'opacity-60' : ''}`} aria-busy={loading}>
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
      )}
    </section>
  )
}

const fmtDate = (day) =>
  new Date(`${day}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })
