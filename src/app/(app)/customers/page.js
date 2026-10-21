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
  checkedAgo,
  connLabel,
  connTone,
  parseFilters,
  tileActive,
  toQuery,
} from '@/lib/customer-filters'
import { formatSignal } from '@/lib/connection'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Input'
import { Toast } from '@/components/ui/Toast'
import { IconDownload, IconFilters, IconUpload, IconUsers } from '@/components/ui/icons'
import BuildingFilterSheet from '@/components/buildings/BuildingFilterSheet'
import { SummaryTiles } from '@/components/customers/SummaryTiles'
import { BillingChip, Expiry, PlanCell } from '@/components/customers/CustomerCells'
import { CustomerFilters } from '@/components/customers/CustomerFilters'
import { ImportCustomersModal } from '@/components/customers/ImportCustomersModal'

const DOT = { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn', muted: 'bg-faint' }
const TEXT = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', muted: 'text-muted' }
const PAGE_SIZE = 50

/** Dot + word + muted "checked X ago". The word is always shown: colour is never the only signal. */
function Connection({ row, now }) {
  const tone = connTone(row)
  const ago = checkedAgo(row.connCheckedAt, now)
  return (
    <span className="flex flex-col">
      <span className={`inline-flex items-center gap-2 text-sm font-medium ${TEXT[tone]}`}>
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} />
        {connLabel(row)}
      </span>
      {ago && <span className="pl-4 text-xs font-normal text-muted">{ago}</span>}
    </span>
  )
}

const signalOf = (row) => formatSignal(row.connRxDbm == null ? null : { best: { rxDbm: row.connRxDbm, rxQuality: row.connRxQuality } })
const placeOf = (row) => [row.building?.buildingName, row.wing?.name].filter(Boolean).join(' · ')
const customerHref = (row) => `/buildings/${row.building?.id}/customers/${row.id}`

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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState(null)
  const [reloads, setReloads] = useState(0)
  // The answer is tied to the request it answered, so "loading" is derived, never set in an effect.
  const [result, setResult] = useState(null)
  const requestKey = `${queryString}#${reloads}`

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

  useEffect(() => {
    let alive = true
    apiClient
      .get('/customers/list', { params: { ...Object.fromEntries(new URLSearchParams(queryString)), pageSize: PAGE_SIZE } })
      .then((res) => alive && setResult({ key: requestKey, data: res.data.data, at: Date.now() }))
      .catch((err) => alive && setResult({ key: requestKey, error: getApiErrorMessage(err, 'Could not load customers') }))
    return () => {
      alive = false
    }
  }, [queryString, requestKey])

  const current = result?.key === requestKey ? result : null
  const loading = !current
  const data = current?.data ?? result?.data ?? null // keep the last answer's counts/facets while reloading
  const facets = data?.facets
  const now = result?.at ?? 0 // the moment the answer arrived — keeps render pure
  const activeCount = activeFilterCount(filters)

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
    navigate({ ...filters, q: '', zoneId: '', networkZone: '', operator: '', billingStatus: '', conn: '', weak: '', expiry: '', buildingId: '', planName: '', autoRenewal: '', page: 1 })
  }

  async function download() {
    setExporting(true)
    try {
      const { name } = await exportCustomers(filters)
      setToast(`Saved ${name}`)
    } catch (err) {
      setToast(err.message)
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Customer',
      render: (r) => (
        <Link href={customerHref(r)} className="block font-medium text-ink hover:text-fiber" onClick={(e) => e.stopPropagation()}>
          {r.name}
          {r.username && <span className="block text-xs font-normal text-muted">{r.username}</span>}
        </Link>
      ),
    },
    { key: 'building', header: 'Building · Wing', render: (r) => placeOf(r) || '—' },
    { key: 'zone', header: 'Our zone', render: (r) => r.zone?.name ?? '—' },
    { key: 'operator', header: 'Operator', render: (r) => r.operator ?? '—' },
    {
      key: 'plan',
      header: 'Plan',
      render: (r) => <PlanCell row={r} />,
    },
    { key: 'expiry', header: 'Expiry', render: (r) => <Expiry row={r} now={now} /> },
    {
      key: 'status',
      header: 'Billing',
      render: (r) => <BillingChip status={r.status} />,
    },
    { key: 'conn', header: 'Connection', render: (r) => <Connection row={r} now={now} /> },
    { key: 'signal', header: 'Signal', render: (r) => signalOf(r) ?? '—' },
  ]

  const renderCard = (r) => (
    <Link href={customerHref(r)} className="block rounded-card border border-line bg-card p-4 shadow-soft">
      <p className="font-medium text-ink">{r.name}</p>
      <p className="mt-0.5 text-sm text-muted">{placeOf(r) || 'No building'}</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <Connection row={r} now={now} />
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
        tiles={TILES.map((tile) => {
          const n = data?.counts?.[tile.countKey]
          return { id: tile.id, label: tile.label, count: loading && n == null ? null : (n ?? 0), active: tileActive(filters, tile) }
        })}
        onPick={(t) => navigate(applyTile(filters, TILES.find((x) => x.id === t.id)))}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchInput
          value={draft}
          onChange={onSearch}
          placeholder="Search name, mobile or username"
          className="min-w-0 flex-1 sm:max-w-md"
        />
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
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex h-12 items-center gap-2 rounded-btn border border-line bg-card px-4 text-sm font-medium lg:hidden"
        >
          <IconFilters className="h-4 w-4" />
          Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      <div className="mb-5 hidden grid-cols-2 gap-3 lg:grid xl:grid-cols-4">
        <CustomerFilters filters={filters} facets={facets} onChange={change} idSuffix="-inline" />
      </div>

      <BuildingFilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onClear={clearAll} activeCount={activeCount}>
        <CustomerFilters filters={filters} facets={facets} onChange={change} idSuffix="-sheet" />
      </BuildingFilterSheet>

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
          rows={current?.data?.rows}
          loading={loading}
          renderCard={renderCard}
          onRowClick={(r) => router.push(customerHref(r))}
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
