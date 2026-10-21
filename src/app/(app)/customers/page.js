'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { exportCustomers } from '@/lib/export-customers'
import {
  TILES,
  SORT_OPTIONS,
  activeFilterCount,
  applyTile,
  connTitle,
  customerDetailHref,
  filterChips,
  mergeRows,
  parseFilters,
  staleIds,
  tileActive,
  toQuery,
  visibleTiles,
} from '@/lib/customer-filters'
import { formatSignal } from '@/lib/connection'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Input'
import { Toast } from '@/components/ui/Toast'
import { IconClose, IconDownload, IconFilters, IconRefresh, IconUpload, IconUsers } from '@/components/ui/icons'
import { SummaryTiles } from '@/components/customers/SummaryTiles'
import { ConnectionCell, Expiry, PlanCell } from '@/components/customers/CustomerCells'
import { CustomerFilterPanel } from '@/components/customers/CustomerFilterPanel'
import { ImportCustomersModal } from '@/components/customers/ImportCustomersModal'

const PAGE_SIZE = 50

/** One-line connection cell from a list row; the long "checked 18 min ago" is the tooltip. */
function Connection({ row, now, checking, notRefreshed }) {
  return (
    <ConnectionCell
      state={row.connState}
      lastSeen={row.connLastSeen}
      checkedAt={row.connCheckedAt}
      oltReachable={row.oltReachable}
      checking={checking}
      now={now}
      title={notRefreshed ? `Not refreshed — showing saved status. ${connTitle(row, now) ?? ''}`.trim() : connTitle(row, now)}
    />
  )
}

const signalOf = (row) => formatSignal(row.connRxDbm == null ? null : { best: { rxDbm: row.connRxDbm, rxQuality: row.connRxQuality } })
const placeOf = (row) => [row.building?.buildingName, row.wing?.name].filter(Boolean).join(' · ')
const FILTER_RESET = { zoneId: '', networkZone: '', operator: '', billingStatus: '', conn: '', weak: '', expiry: '', buildingId: '', planName: '', autoRenewal: '' }
function CustomersList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN'
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])
  const queryString = toQuery(filters).toString()

  // Search box: typed text shows at once, the URL (and the request) follows ~300 ms later.
  const [draft, setDraft] = useState(filters.q)
  const [pending, setPending] = useState(false) // a typed value is waiting for its debounce
  const [seenQ, setSeenQ] = useState(filters.q)
  const timer = useRef(null)
  // The timer fires later than the keystroke: it must apply to the filters as they are THEN.
  const latest = useRef({ filters, change: null })
  // Back/Forward or a link with ?q= changes the URL: the box follows it, unless the user is mid-typing.
  if (seenQ !== filters.q) {
    setSeenQ(filters.q)
    if (!pending) setDraft(filters.q)
  }
  const [panelOpen, setPanelOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState(null)
  const [reloads, setReloads] = useState(0)
  // The answer is tied to the request it answered, so "loading" is derived, never set in an effect.
  const [result, setResult] = useState(null)
  const requestKey = `${queryString}#${reloads}`
  // Fresh OLT status for the visible rows. Everything below is keyed by the id of the list LOAD it
  // belongs to (a counter, never reused), so an old refresh can't touch newer rows, counts or flags
  // even when the user returns to the same page or filter.
  const [fresh, setFresh] = useState({ id: 0, byId: {}, counts: null, pending: [] })
  const [checking, setChecking] = useState({ id: 0, ids: [] })
  const [note, setNote] = useState({ id: 0, kind: null }) // 'failed' | 'limited'
  const [cooldown, setCooldown] = useState(false) // after a forced refresh the backend ignores force for 30 s
  const loadSeq = useRef(0)
  const cooldownTimer = useRef(null)

  const navigate = useCallback(
    (next) => {
      const qs = toQuery(next).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  // Any filter change goes back to page 1.
  const change = useCallback(
    (patch) => navigate({ ...filters, ...patch, page: 'page' in patch ? patch.page : 1 }),
    [navigate, filters],
  )

  useEffect(() => {
    latest.current = { filters, change }
  })
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => () => clearTimeout(cooldownTimer.current), [])

  // Ask the backend to re-check these customers. Rows come back merged by id; counts are refetched
  // quietly (no loading state) so the tiles catch up without a flicker.
  const runRefresh = useCallback(async (id, qs, ids, force) => {
    if (ids.length === 0) return
    const stillCurrent = () => loadSeq.current === id
    setChecking({ id, ids })
    setNote((n) => (n.id === id ? { id, kind: null } : n))
    try {
      const res = await apiClient.post('/customers/refresh', { ids, force })
      if (!stillCurrent()) return
      const rows = res.data.data?.rows ?? []
      const pending = res.data.data?.pending ?? []
      setFresh((prev) => {
        const base = prev.id === id ? prev : { id, byId: {}, counts: null, pending: [] }
        const returned = new Set(rows.map((r) => r.id))
        return {
          ...base,
          byId: { ...base.byId, ...Object.fromEntries(rows.map((r) => [r.id, r])) },
          pending: [...base.pending.filter((x) => !returned.has(x)), ...pending],
        }
      })
      if (force) {
        setCooldown(true)
        clearTimeout(cooldownTimer.current)
        cooldownTimer.current = setTimeout(() => setCooldown(false), 30000)
      }
      if (rows.length === 0) return
      try {
        const res2 = await apiClient.get('/customers/list', {
          params: { ...Object.fromEntries(new URLSearchParams(qs)), page: 1, pageSize: 1 },
        })
        if (stillCurrent()) setFresh((prev) => (prev.id === id ? { ...prev, counts: res2.data.data?.counts ?? null } : prev))
      } catch {
        // the tiles simply keep their previous numbers
      }
    } catch (err) {
      if (stillCurrent()) setNote({ id, kind: err?.response?.status === 429 ? 'limited' : 'failed' })
    } finally {
      setChecking((c) => (c.id === id ? { id, ids: [] } : c)) // every exit path
    }
  }, [])

  useEffect(() => {
    let alive = true
    const id = ++loadSeq.current
    apiClient
      .get('/customers/list', { params: { ...Object.fromEntries(new URLSearchParams(queryString)), pageSize: PAGE_SIZE } })
      .then((res) => {
        if (!alive) return
        const data = res.data.data
        setResult({ key: requestKey, id, data, at: Date.now() })
        runRefresh(id, queryString, staleIds(data.rows ?? [], Date.now()), false)
      })
      .catch((err) => alive && setResult({ key: requestKey, id, error: getApiErrorMessage(err, 'Could not load customers') }))
    return () => {
      alive = false
    }
  }, [queryString, requestKey, runRefresh])

  const current = result?.key === requestKey ? result : null
  const loading = !current
  const loaded = current?.data ?? result?.data ?? null // keep the last answer's counts/facets while reloading
  const freshNow = current && fresh.id === current.id ? fresh : null
  const data = loaded && freshNow?.counts ? { ...loaded, counts: freshNow.counts } : loaded
  const rows = current?.data ? mergeRows(current.data.rows, Object.values(freshNow?.byId ?? {})) : undefined
  const checkingIds = current && checking.id === current.id ? checking.ids : []
  const pendingIds = freshNow?.pending ?? []
  const noteKind = current && note.id === current.id ? note.kind : null
  const refreshing = checkingIds.length > 0
  const facets = data?.facets
  const now = result?.at ?? 0 // the moment the answer arrived — keeps render pure
  const activeCount = activeFilterCount(filters)
  const chips = filterChips(filters, facets)

  function onSearch(value) {
    setDraft(value)
    setPending(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setPending(false)
      latest.current.change({ q: value.trim() })
    }, 300)
  }

  function clearAll() {
    clearTimeout(timer.current)
    setDraft('')
    setPending(false)
    navigate({ ...filters, ...FILTER_RESET, q: '', page: 1 })
  }

  // Chips' "Clear all" drops the filters but keeps what is typed in the search box.
  function clearFilters() {
    change(FILTER_RESET)
  }

  function applyPanel(draft) {
    setPanelOpen(false)
    change(draft)
  }

  function refreshStatus() {
    if (!current) return
    runRefresh(current.id, queryString, (rows ?? []).map((r) => r.id).slice(0, 50), true)
  }

  async function download() {
    setExporting(true)
    try {
      const { name, truncated } = await exportCustomers(filters)
      setToast(
        truncated
          ? 'Downloaded the first 5,000 customers — narrow the filters to export the rest.'
          : `Saved ${name}`,
      )
    } catch (err) {
      setToast(err.message)
    } finally {
      setExporting(false)
    }
  }

  const detailHref = (row) => customerDetailHref(row.id, pathname, queryString)

  const columns = [
    {
      key: 'name',
      header: 'Customer',
      render: (r) => (
        <Link href={detailHref(r)} className="block font-medium text-ink hover:text-fiber" onClick={(e) => e.stopPropagation()}>
          {r.name}
          {(r.username || r.mobile) && <span className="block break-all text-xs font-normal text-muted">{r.username || r.mobile}</span>}
        </Link>
      ),
    },
    {
      key: 'building',
      header: 'Building · Wing',
      render: (r) => (
        <span title={placeOf(r)} className="line-clamp-2 break-words">
          {placeOf(r) || '—'}
        </span>
      ),
    },
    { key: 'plan', header: 'Plan', render: (r) => <PlanCell row={r} /> },
    { key: 'expiry', header: 'Expiry', className: 'whitespace-nowrap', render: (r) => <Expiry row={r} now={now} /> },
    { key: 'conn', header: 'Connection', render: (r) => <Connection row={r} now={now} checking={checkingIds.includes(r.id)} notRefreshed={pendingIds.includes(r.id)} /> },
    { key: 'signal', header: 'Signal', className: 'whitespace-nowrap', render: (r) => signalOf(r) ?? '—' },
  ]

  const renderCard = (r) => (
    <Link href={detailHref(r)} className="block rounded-card border border-line bg-card p-4 shadow-soft">
      <p className="font-medium text-ink">{r.name}</p>
      {(r.username || r.mobile) && <p className="break-all text-xs text-muted">{r.username || r.mobile}</p>}
      <p className="mt-0.5 text-sm text-muted">{placeOf(r) || 'No building'}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Connection row={r} now={now} checking={checkingIds.includes(r.id)} notRefreshed={pendingIds.includes(r.id)} />
        <span className="text-sm text-muted">{signalOf(r) ?? ''}</span>
      </div>
      <p className="mt-3 text-sm text-muted">
        Expires: <Expiry row={r} now={now} />
      </p>
    </Link>
  )

  const total = data?.total ?? 0
  const pagination = data
    ? { page: data.page, totalPages: Math.max(1, Math.ceil(total / (data.pageSize || PAGE_SIZE))), total }
    : null

  const emptyState = (
    <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-card px-6 py-12 text-center">
      <IconUsers className="h-8 w-8 text-faint" />
      <p className="font-medium">No customers match these filters</p>
      <Button variant="secondary" onClick={clearAll}>
        Clear filters
      </Button>
    </div>
  )

  return (
    <main className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Customers"
        sub={data ? `${total.toLocaleString('en-IN')} customer${total === 1 ? '' : 's'}${activeCount || filters.q ? ' match' : ''}` : 'Every subscriber, filterable'}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={refreshStatus} loading={refreshing} disabled={loading || refreshing || cooldown || !rows?.length}>
              {!refreshing && <IconRefresh className="h-4 w-4" strokeWidth={1.8} />}
              <span className="hidden sm:inline">Refresh status</span>
            </Button>
            <Button variant="secondary" onClick={download} loading={exporting} disabled={loading}>
              <IconDownload className="h-4 w-4" strokeWidth={1.8} />
              <span className="hidden sm:inline">Download CSV</span>
            </Button>
            {isAdmin && (
              <Button onClick={() => setImportOpen(true)}>
                <IconUpload className="h-4 w-4" strokeWidth={1.8} />
                <span className="hidden sm:inline">Upload Excel</span>
              </Button>
            )}
          </div>
        }
      />

      {toast && <Toast key={toast} message={toast} onDone={() => setToast(null)} />}

      <SummaryTiles
        tiles={visibleTiles(data?.counts, filters).map((tile) => {
          const n = data?.counts?.[tile.countKey]
          return { id: tile.id, label: tile.label, count: loading && n == null ? null : (n ?? 0), active: tileActive(filters, tile) }
        })}
        onPick={(t) => navigate(applyTile(filters, TILES.find((x) => x.id === t.id)))}
      />

      {noteKind === 'failed' && <p className="mb-2 text-xs text-muted">Couldn&apos;t refresh status — showing saved status</p>}
      {noteKind === 'limited' && <p className="mb-2 text-xs text-muted">Too many refreshes — try again in a minute</p>}
      {cooldown && !refreshing && !noteKind && <p className="mb-2 text-xs text-muted">Refreshed just now</p>}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput
          value={draft}
          onChange={onSearch}
          placeholder="Search name, mobile or username"
          className="min-w-0 basis-full sm:basis-auto sm:flex-1 sm:max-w-md"
        />
        <Button type="button" variant="secondary" onClick={() => setPanelOpen(true)} aria-haspopup="dialog">
          <IconFilters className="h-4 w-4" />
          Filters
          {activeCount > 0 && <span className="rounded-full bg-fiber-tint px-2 py-0.5 text-xs font-semibold text-fiber">{activeCount}</span>}
        </Button>
        <Select
          id="customers-sort-top"
          aria-label="Sort by"
          value={filters.sort}
          onChange={(e) => change({ sort: e.target.value })}
          className="w-44"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </Select>
      </div>

      {chips.length > 0 && (
        <ul className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((c) => (
            <li key={c.key} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-fiber-tint py-1 pl-3 pr-1.5 text-sm font-medium text-fiber">
              <span className="truncate">{c.label}</span>
              <button
                type="button"
                aria-label={`Remove filter: ${c.label}`}
                onClick={() => change(c.patch)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-fiber/10"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {chips.length >= 2 && (
            <li>
              <button type="button" onClick={clearFilters} className="px-2 py-1 text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
                Clear all
              </button>
            </li>
          )}
        </ul>
      )}

      {panelOpen && <CustomerFilterPanel filters={filters} facets={facets} onApply={applyPanel} onClose={() => setPanelOpen(false)} />}

      {current?.error ? (
        <div className="flex items-center justify-between gap-3 rounded-btn bg-bad-tint px-4 py-3 text-sm text-bad">
          <span>{current.error}</span>
          <Button variant="secondary" onClick={() => setReloads((n) => n + 1)}>
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          renderCard={renderCard}
          onRowClick={(r) => router.push(detailHref(r))}
          emptyState={emptyState}
          pagination={pagination}
          onPageChange={(page) => change({ page })}
        />
      )}

      {importOpen && (
        <ImportCustomersModal
          onClose={() => setImportOpen(false)}
          onImported={() => setReloads((n) => n + 1)}
        />
      )}
    </main>
  )
}

export default function CustomersPage() {
  // useSearchParams needs a Suspense boundary (Next 16 docs: use-search-params).
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-card bg-line/40" />}>
      <CustomersList />
    </Suspense>
  )
}
