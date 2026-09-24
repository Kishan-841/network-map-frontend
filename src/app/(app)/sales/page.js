'use client'

import { useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { canAssignSalesBuildings, isSales, isSalesExecutive, isSalesManager, ROLE_LABELS } from '@/lib/roles'
import { useSalesBuildings, invalidateSalesBuildings, useOpenVisit } from '@/hooks/useSales'
import { useClientTable } from '@/hooks/useClientTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { AssignToTeamModal } from '@/components/sales/AssignToTeamModal'
import { BuildingSearchAssign } from '@/components/sales/BuildingSearchAssign'
import { CheckInModal } from '@/components/sales/CheckInModal'
import { OpenVisitCard } from '@/components/sales/OpenVisitCard'

const holderOf = (b) => b.salesAssignments?.[0]?.assignedTo ?? null
// Module-level so the memo inside useClientTable stays stable.
const searchText = (b) => [b.buildingName, b.formattedAddress, holderOf(b)?.name]

export default function SalesPage() {
  const role = useAuthStore((s) => s.user?.role)
  const canAssign = canAssignSalesBuildings(role)
  const isExec = isSalesExecutive(role)
  // A manager (or admin) searches the whole registry to assign from; a team
  // leader distributes their own pool below instead.
  const canSearchRegistry = role === 'ADMIN' || isSalesManager(role)
  // Field users (SE + TL) check in to their assigned buildings and do the work.
  const canAct = isSales(role)

  const { buildings, loading } = useSalesBuildings()
  const { visit: openVisit, refresh: refreshOpen } = useOpenVisit(canAct)
  const table = useClientTable(buildings, { getSearchText: searchText })
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [assigning, setAssigning] = useState(false)
  const [checkInFor, setCheckInFor] = useState(null)
  const [toast, setToast] = useState(null)

  const clearSelection = () => setSelectedIds(new Set())

  // One open visit at a time: while checked in somewhere, Check-in is disabled.
  const RowActions = ({ building }) => (
    <div className="flex justify-end">
      <Button className="h-9 min-h-9" disabled={Boolean(openVisit)} onClick={() => setCheckInFor(building)}>
        Check in
      </Button>
    </div>
  )

  const baseColumns = useMemo(() => {
    const cols = [
      {
        key: 'building',
        header: 'Building',
        // Cap the width so a long address truncates instead of pushing the
        // Check-in button off to the right.
        render: (b) => (
          <div className="min-w-0 max-w-[12rem] sm:max-w-[20rem] lg:max-w-[26rem]">
            <p className="truncate font-medium text-ink">{b.buildingName}</p>
            <p className="truncate text-sm font-normal text-muted">{b.formattedAddress}</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (b) =>
          b.isLive ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Live
            </span>
          ) : (
            <span className="text-sm font-normal text-muted">Not live</span>
          ),
      },
    ]
    // Managers and team leaders need to see who currently holds each building.
    if (!isExec) {
      cols.push({
        key: 'holder',
        header: 'Held by',
        render: (b) => {
          const h = holderOf(b)
          return h ? (
            <span className="text-sm font-normal">
              {h.name} <span className="text-muted">· {ROLE_LABELS[h.role] ?? h.role}</span>
            </span>
          ) : (
            <span className="text-sm font-normal text-muted">—</span>
          )
        },
      })
    }
    return cols
  }, [isExec])

  // Actions rebuild each render (they read `visitingId`), so they are appended
  // outside the memo.
  const columns = canAct
    ? [
        ...baseColumns,
        {
          key: 'actions',
          header: '',
          headerClassName: 'text-right',
          className: 'text-right',
          render: (b) => <RowActions building={b} />,
        },
      ]
    : baseColumns

  const renderCard = (b) => {
    const h = holderOf(b)
    return (
      <div className="rounded-card border border-line bg-card p-3 shadow-soft">
        <p className="truncate font-medium text-ink">{b.buildingName}</p>
        <p className="truncate text-sm font-normal text-muted">{b.formattedAddress}</p>
        <p className="mt-1 text-sm font-normal">
          {b.isLive ? (
            <span className="font-medium text-ok">● Live</span>
          ) : (
            <span className="text-muted">Not live</span>
          )}
          {!isExec && h && (
            <span className="text-muted">
              {' · '}
              {h.name} ({ROLE_LABELS[h.role] ?? h.role})
            </span>
          )}
        </p>
        {canAct && (
          <div className="mt-3 border-t border-line pt-3">
            <RowActions building={b} />
          </div>
        )}
      </div>
    )
  }

  const selection = canAssign
    ? {
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
    : undefined

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Field sales"
        title="Sales"
        sub={isExec ? 'The buildings assigned to you' : "Your team's building pool — select to assign"}
      />

      {toast && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-btn bg-ok-tint px-4 py-3 text-sm font-medium text-ok">
          {toast}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-medium underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {canAct && openVisit && (
        <OpenVisitCard
          visit={openVisit}
          onChanged={() => {
            refreshOpen()
            invalidateSalesBuildings()
          }}
        />
      )}

      {canSearchRegistry && (
        <BuildingSearchAssign onAssigned={(n) => setToast(`${n} building${n === 1 ? '' : 's'} assigned`)} />
      )}

      {canAssign && selectedIds.size > 0 && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-card border border-fiber/30 bg-card px-4 py-3 shadow-lift">
          <p className="text-sm font-medium">{selectedIds.size} selected</p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex h-9 items-center rounded-btn border border-line px-3.5 text-sm font-medium text-muted transition-colors hover:border-faint hover:text-ink"
            >
              Clear
            </button>
            <Button className="h-9 min-h-9" onClick={() => setAssigning(true)}>
              Assign to…
            </Button>
          </div>
        </div>
      )}

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
            clearSelection()
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
