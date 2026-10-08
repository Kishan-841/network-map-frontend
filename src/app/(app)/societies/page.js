'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Input'
import { StatusChip } from '@/components/societies/StatusChip'
import { PERMISSION_STATUS_OPTIONS, istDate, personMetText } from '@/lib/society'

const PAGE_SIZE = 20

/** "8 Oct 2026 — Met the secretary, will call back" (the remark clipped by CSS). */
function LastVisit({ visit }) {
  if (!visit) return <span className="text-muted">—</span>
  return (
    <span className="block min-w-0">
      <span className="block whitespace-nowrap text-sm font-medium text-ink">{istDate(visit.createdAt)}</span>
      <span className="line-clamp-1 break-all text-sm font-normal text-muted" title={visit.remark}>
        {visit.remark}
      </span>
    </span>
  )
}

/**
 * Society permissions: the buildings a permission executive is working on for
 * fibre-laying permission. A PE sees their own (the API scopes it); the admin
 * sees everyone's, with who added each and a filter by executive. A row opens
 * the building's page — details and the full visit history.
 */
export default function SocietiesPage() {
  const router = useRouter()
  const role = useAuthStore((s) => s.user?.role)
  const isAdmin = role === 'ADMIN'

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('')
  const [createdById, setCreatedById] = useState('')
  const [page, setPage] = useState(1)
  const [executives, setExecutives] = useState([])
  // { key, data } or { key, error } — loading is derived from a key mismatch,
  // so no effect sets state synchronously (react-hooks/set-state-in-effect).
  const [result, setResult] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // The admin's executive picker: every permission executive, active or not.
  // GET /users ignores a role filter, so pick them out here.
  useEffect(() => {
    if (!isAdmin) return undefined
    let alive = true
    apiClient
      .get('/users')
      .then((res) => {
        if (!alive) return
        const list = (res.data.data ?? []).filter((u) => u.role === 'PERMISSION_EXECUTIVE')
        setExecutives(list.sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => alive && setExecutives([]))
    return () => {
      alive = false
    }
  }, [isAdmin])

  const params = useMemo(() => {
    const p = { page, pageSize: PAGE_SIZE }
    if (debounced) p.search = debounced
    if (status) p.status = status
    if (isAdmin && createdById) p.createdById = createdById
    return p
  }, [page, debounced, status, createdById, isAdmin])
  const key = JSON.stringify(params)

  useEffect(() => {
    if (!role) return undefined
    let alive = true
    apiClient
      .get('/permission-buildings', { params })
      .then((res) => alive && setResult({ key, data: res.data.data }))
      .catch((err) => alive && setResult({ key, error: getApiErrorMessage(err, 'Could not load societies') }))
    return () => {
      alive = false
    }
  }, [role, params, key])

  const loading = result?.key !== key
  const current = loading ? null : result
  const rows = current?.data?.items ?? []
  const pagination = current?.data?.pagination

  // A new search starts on page 1 — set with the filter, not in an effect.
  const onSearch = (v) => {
    setSearch(v)
    setPage(1)
  }
  const onStatus = (e) => {
    setStatus(e.target.value)
    setPage(1)
  }
  const onExecutive = (e) => {
    setCreatedById(e.target.value)
    setPage(1)
  }

  const open = (b) => router.push(`/societies/${b.id}`)

  const columns = [
    {
      key: 'building',
      header: 'Building',
      render: (b) => <span className="font-medium text-ink">{b.buildingName}</span>,
    },
    {
      key: 'area',
      header: 'Area / address',
      className: 'max-w-56',
      render: (b) => (
        <span className="line-clamp-2 text-muted" title={b.formattedAddress}>
          {b.formattedAddress}
        </span>
      ),
    },
    { key: 'person', header: 'Person met', render: (b) => personMetText(b.contact) || '—' },
    { key: 'status', header: 'Status', render: (b) => <StatusChip status={b.permissionStatus} /> },
    { key: 'last', header: 'Last visit', className: 'max-w-64', render: (b) => <LastVisit visit={b.lastVisit} /> },
    { key: 'visits', header: 'Visits', className: 'tabular-nums text-right', render: (b) => b.visitCount },
    ...(isAdmin ? [{ key: 'by', header: 'Added by', render: (b) => b.createdBy?.name ?? '—' }] : []),
  ]

  const renderCard = (b) => (
    <button
      type="button"
      onClick={() => open(b)}
      className="block w-full min-w-0 rounded-card border border-line bg-card p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words font-medium text-ink">{b.buildingName}</p>
        <StatusChip status={b.permissionStatus} className="shrink-0" />
      </div>
      <p className="mt-0.5 line-clamp-2 break-words text-sm font-normal text-muted">{b.formattedAddress}</p>
      {b.contact && <p className="mt-2 text-sm font-normal text-ink">{personMetText(b.contact)}</p>}
      {b.lastVisit && (
        <p className="mt-2 line-clamp-2 break-words text-sm font-normal text-muted">
          <span className="font-medium text-ink">{istDate(b.lastVisit.createdAt)}</span> — {b.lastVisit.remark}
        </p>
      )}
      <p className="mt-2 text-xs font-medium text-faint">
        {b.visitCount} {b.visitCount === 1 ? 'entry' : 'entries'}
        {isAdmin && b.createdBy ? ` · added by ${b.createdBy.name}` : ''}
      </p>
    </button>
  )

  const filtered = Boolean(debounced || status || createdById)

  return (
    <main className="mx-auto max-w-6xl">
      <PageHeader
        title="Society permissions"
        sub={isAdmin ? 'Every executive’s societies — open one for its visit history' : 'Societies you are working on — open one to add a visit update'}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Search name or address"
          className="sm:col-span-2"
        />
        <Select id="sp-status" aria-label="Status" value={status} onChange={onStatus}>
          <option value="">All statuses</option>
          {PERMISSION_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {isAdmin && (
          <Select id="sp-exec" aria-label="Executive" value={createdById} onChange={onExecutive}>
            <option value="">All executives</option>
            {executives.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {current?.error && (
        <p className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{current.error}</p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={open}
        renderCard={renderCard}
        pagination={pagination}
        onPageChange={setPage}
        emptyState={
          current?.error ? null : (
            <p className="py-8 text-center text-sm font-normal text-muted">
              {filtered
                ? 'No societies match these filters.'
                : isAdmin
                  ? 'No society has been added yet.'
                  : 'No societies yet. Use “Add building” after your first visit.'}
            </p>
          )
        }
      />
    </main>
  )
}
