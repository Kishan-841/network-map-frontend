'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { canAssignSalesBuildings, isSalesExecutive, isSalesManager, ROLE_LABELS } from '@/lib/roles'
import { useSalesBuildings, invalidateSalesBuildings, useOpenVisit } from '@/hooks/useSales'
import { useBuildings } from '@/hooks/useBuildings'
import { useOperators } from '@/hooks/useOperators'
import { useZones } from '@/hooks/useZones'
import { useClientTable } from '@/hooks/useClientTable'
import { TIER_LABEL } from '@/lib/home-pass-tier'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { AssignToTeamModal } from '@/components/sales/AssignToTeamModal'
import { CheckInModal } from '@/components/sales/CheckInModal'
import { OpenVisitCard } from '@/components/sales/OpenVisitCard'

const holderOf = (b) => b.salesAssignments?.[0]?.assignedTo ?? null
const TIER_OPTIONS = ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'UNRATED']

// A reusable multi-select checkbox handler for the assign flow.
function useSelection() {
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const clear = () => setSelectedIds(new Set())
  const selection = {
    selectedIds,
    onToggle: (id) =>
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    onToggleAll: (ids, checked) =>
      setSelectedIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => (checked ? next.add(id) : next.delete(id)))
        return next
      }),
  }
  return { selectedIds, clear, selection }
}

function AssignBar({ count, onClear, onAssign }) {
  if (count === 0) return null
  return (
    <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-card border border-fiber/30 bg-card px-4 py-3 shadow-lift">
      <p className="text-sm font-medium">{count} selected</p>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-9 items-center rounded-btn border border-line px-3.5 text-sm font-medium text-muted transition-colors hover:border-faint hover:text-ink"
        >
          Clear
        </button>
        <Button className="h-9 min-h-9" onClick={onAssign}>
          Assign to…
        </Button>
      </div>
    </div>
  )
}

const statusCell = (b) =>
  b.isLive ? (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ok">
      <span className="h-1.5 w-1.5 rounded-full bg-ok" />
      Live
    </span>
  ) : (
    <span className="text-sm font-normal text-muted">Not live</span>
  )

const heldByCell = (b) => {
  const h = holderOf(b)
  return h ? (
    <span className="text-sm font-normal">
      {h.name} <span className="text-muted">· {ROLE_LABELS[h.role] ?? h.role}</span>
    </span>
  ) : (
    <span className="text-sm font-normal text-muted">—</span>
  )
}

/**
 * Manager / admin: browse the WHOLE coverage registry, filter by operator /
 * zone / tier, and multi-select buildings to assign straight to a team leader
 * or executive. Server-side filtering + pagination via GET /buildings (the
 * sales manager reads it coverage-scoped, read-only).
 */
function ManagerRegistry() {
  const [operatorId, setOperatorId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [tier, setTier] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [assigning, setAssigning] = useState(false)
  const [toast, setToast] = useState(null)
  const { selectedIds, clear, selection } = useSelection()

  // Debounce the search box so a keystroke isn't a request; any filter change
  // returns to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => setPage(1), [operatorId, zoneId, tier])

  const { operators } = useOperators()
  const { zones } = useZones()
  const filters = useMemo(
    () => ({ operatorId, zoneId, tier, search: debouncedSearch, page, pageSize: 20 }),
    [operatorId, zoneId, tier, debouncedSearch, page],
  )
  const { buildings, pagination, loading, refetch } = useBuildings(filters)

  const columns = [
    {
      key: 'building',
      header: 'Building',
      render: (b) => (
        <div className="min-w-0 max-w-[12rem] sm:max-w-[20rem] lg:max-w-[26rem]">
          <p className="truncate font-medium text-ink">{b.buildingName}</p>
          <p className="truncate text-sm font-normal text-muted">{b.formattedAddress}</p>
        </div>
      ),
    },
    { key: 'tier', header: 'Tier', render: (b) => (b.homePassTier ? TIER_LABEL[b.homePassTier] : '—') },
    {
      key: 'homePass',
      header: 'Home pass',
      className: 'tabular-nums',
      render: (b) => b.details?.homePass ?? '—',
    },
    { key: 'zone', header: 'Zone', render: (b) => b.zone?.name ?? '—' },
    { key: 'status', header: 'Status', render: statusCell },
    { key: 'holder', header: 'Held by', render: heldByCell },
  ]

  const renderCard = (b) => (
    <div className="rounded-card border border-line bg-card p-3 shadow-soft">
      <p className="truncate font-medium text-ink">{b.buildingName}</p>
      <p className="truncate text-sm font-normal text-muted">{b.formattedAddress}</p>
      <p className="mt-1 text-sm font-normal text-muted">
        {b.zone?.name ?? 'No zone'}
        {b.homePassTier ? ` · ${TIER_LABEL[b.homePassTier]}` : ''}
        {b.details?.homePass != null ? ` · ${b.details.homePass} home pass` : ''} ·{' '}
        {holderOf(b) ? holderOf(b).name : 'Unassigned'}
      </p>
    </div>
  )

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Field sales" title="Sales" sub="Every building in the registry — filter, select and assign to your team" />
      <Toast key={toast} message={toast} onDone={() => setToast(null)} />

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select id="f-operator" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
          <option value="">All operators</option>
          {(operators ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select id="f-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          <option value="">All zones</option>
          {(zones ?? []).map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </Select>
        <Select id="f-tier" value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">All tiers</option>
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t] ?? 'Unrated'}
            </option>
          ))}
        </Select>
      </div>

      <AssignBar count={selectedIds.size} onClear={clear} onAssign={() => setAssigning(true)} />

      <SearchInput value={search} onChange={setSearch} placeholder="Search by building or address…" className="mb-4" />

      <DataTable
        columns={columns}
        rows={buildings}
        loading={loading}
        keyField="id"
        selection={selection}
        renderCard={renderCard}
        emptyState={<p className="text-sm font-normal text-muted">No buildings match these filters.</p>}
      />
      <Pagination pagination={pagination} onChange={setPage} />

      {assigning && (
        <AssignToTeamModal
          buildingIds={[...selectedIds]}
          onClose={() => setAssigning(false)}
          onDone={({ count }) => {
            setAssigning(false)
            clear()
            refetch()
            invalidateSalesBuildings()
            setToast(`${count} building${count === 1 ? '' : 's'} assigned`)
          }}
        />
      )}
    </main>
  )
}

/**
 * Team leader / executive: their assigned pool. An executive checks buildings
 * in and does the work; a team leader can also multi-select to distribute to
 * their executives.
 */
function FieldPool({ role }) {
  const isExec = isSalesExecutive(role)
  const canAssign = canAssignSalesBuildings(role) // a TEAM_LEADER here
  const { buildings, loading } = useSalesBuildings()
  const { visit: openVisit, refresh: refreshOpen } = useOpenVisit(true)
  const table = useClientTable(buildings, { getSearchText: (b) => [b.buildingName, b.formattedAddress, holderOf(b)?.name] })
  const { selectedIds, clear, selection: sel } = useSelection()
  const [assigning, setAssigning] = useState(false)
  const [checkInFor, setCheckInFor] = useState(null)
  const [toast, setToast] = useState(null)

  const RowActions = ({ building }) => (
    <div className="flex justify-end">
      <Button className="h-9 min-h-9" disabled={Boolean(openVisit)} onClick={() => setCheckInFor(building)}>
        Check in
      </Button>
    </div>
  )

  const columns = [
    {
      key: 'building',
      header: 'Building',
      render: (b) => (
        <div className="min-w-0 max-w-[12rem] sm:max-w-[20rem] lg:max-w-[26rem]">
          <p className="truncate font-medium text-ink">{b.buildingName}</p>
          <p className="truncate text-sm font-normal text-muted">{b.formattedAddress}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: statusCell },
    ...(isExec ? [] : [{ key: 'holder', header: 'Held by', render: heldByCell }]),
    { key: 'actions', header: '', headerClassName: 'text-right', className: 'text-right', render: (b) => <RowActions building={b} /> },
  ]

  const renderCard = (b) => {
    const h = holderOf(b)
    return (
      <div className="rounded-card border border-line bg-card p-3 shadow-soft">
        <p className="truncate font-medium text-ink">{b.buildingName}</p>
        <p className="truncate text-sm font-normal text-muted">{b.formattedAddress}</p>
        <p className="mt-1 text-sm font-normal">
          {b.isLive ? <span className="font-medium text-ok">● Live</span> : <span className="text-muted">Not live</span>}
          {!isExec && h && <span className="text-muted"> · {h.name} ({ROLE_LABELS[h.role] ?? h.role})</span>}
        </p>
        <div className="mt-3 border-t border-line pt-3">
          <RowActions building={b} />
        </div>
      </div>
    )
  }

  const selection = canAssign ? sel : undefined

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Field sales"
        title="Sales"
        sub={isExec ? 'The buildings assigned to you' : "Your team's building pool — select to assign"}
      />
      <Toast key={toast} message={toast} onDone={() => setToast(null)} />

      {openVisit && (
        <OpenVisitCard
          visit={openVisit}
          onChanged={() => {
            refreshOpen()
            invalidateSalesBuildings()
          }}
        />
      )}

      {canAssign && <AssignBar count={selectedIds.size} onClear={clear} onAssign={() => setAssigning(true)} />}

      <SearchInput
        value={table.search}
        onChange={table.onSearchChange}
        placeholder="Search by building, address or holder…"
        className="mb-4"
      />

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={loading}
        keyField="id"
        selection={selection}
        renderCard={renderCard}
        emptyState={
          <p className="text-sm font-normal text-muted">
            {isExec ? 'No buildings are assigned to you yet.' : 'No buildings in your pool yet.'}
          </p>
        }
      />
      <Pagination pagination={table.pagination} onChange={table.onPageChange} />

      {assigning && (
        <AssignToTeamModal
          buildingIds={[...selectedIds]}
          onClose={() => setAssigning(false)}
          onDone={({ count }) => {
            setAssigning(false)
            clear()
            invalidateSalesBuildings()
            setToast(`${count} building${count === 1 ? '' : 's'} assigned`)
          }}
        />
      )}

      {checkInFor && (
        <CheckInModal
          building={checkInFor}
          onClose={() => setCheckInFor(null)}
          onDone={() => {
            setToast(`Checked in to ${checkInFor.buildingName}`)
            setCheckInFor(null)
            refreshOpen()
          }}
        />
      )}
    </main>
  )
}

export default function SalesPage() {
  const role = useAuthStore((s) => s.user?.role)
  const isManagerView = role === 'ADMIN' || isSalesManager(role)
  return isManagerView ? <ManagerRegistry /> : <FieldPool role={role} />
}
