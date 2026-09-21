'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { useClientTable } from '@/hooks/useClientTable'

// Search a POP by its name or the zone it sits in.
const popSearchText = (pop) => [pop.name, pop.zone?.name]
import { IconPlus, IconEdit, IconTrash } from '@/components/ui/icons'
import { usePops, invalidatePops } from '@/hooks/usePops'
import { invalidateFibers } from '@/hooks/useFibers'
import { canManageFiber } from '@/lib/roles'
import { POINT_COLORS } from '@/lib/fiber/constants'
import { useAuthStore } from '@/stores/auth-store'
import PopForm from '@/components/fiber/PopForm'
import DetailDrawer from '@/components/fiber/details/DetailDrawer'
import { useDetailStack } from '@/components/fiber/details/useDetailStack'

const emptyForm = {
  name: '',
  zoneId: '',
  latitude: '',
  longitude: '',
  notes: '',
  serverLocation: '',
  rackSize: '',
  rackCondition: '',
  upsBatteryCount: '',
  images: [],
  olts: [],
  devices: [],
}

const toForm = (pop) => ({
  name: pop.name,
  zoneId: pop.zoneId ?? '',
  latitude: String(pop.latitude),
  longitude: String(pop.longitude),
  notes: pop.notes ?? '',
  serverLocation: pop.serverLocation ?? '',
  rackSize: pop.rackSize ?? '',
  rackCondition: pop.rackCondition ?? '',
  upsBatteryCount: pop.upsBatteryCount == null ? '' : String(pop.upsBatteryCount),
  images: pop.images ?? [],
  olts: (pop.olts ?? []).map((olt) => ({
    id: olt.id,
    name: olt.name,
    ponPortCount: String(olt.ponPortCount),
    ipAddress: olt.ipAddress ?? '',
    type: olt.type ?? '',
    model: olt.model ?? '',
  })),
  devices: (pop.devices ?? []).map((device) => ({
    id: device.id,
    kind: device.kind,
    label: device.label ?? '',
    ipAddress: device.ipAddress ?? '',
    portCount: device.portCount ?? undefined,
    speed: device.speed ?? '',
    model: device.model ?? '',
  })),
})

// Just how many OLTs — the names, ports and fibers are in the detail drawer.
const oltCount = (pop) => pop.olts?.length ?? 0

function RowActions({ pop, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        aria-label="Edit"
        onClick={(e) => {
          e.stopPropagation()
          onEdit(pop)
        }}
        className="flex h-9 w-9 min-h-11 items-center justify-center rounded-btn text-muted transition-colors hover:bg-paper hover:text-ink"
      >
        <IconEdit className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        aria-label="Delete"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(pop)
        }}
        className="flex h-9 w-9 min-h-11 items-center justify-center rounded-btn text-muted transition-colors hover:bg-bad-tint hover:text-bad"
      >
        <IconTrash className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </div>
  )
}

function AdminPopsPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = canManageFiber(user)
  // Only the maker and an ADMIN see a row, so say whose list this is.
  const isAdmin = user?.role === 'ADMIN'
  const { pops, loading } = usePops()
  const [listError, setListError] = useState(null)
  const table = useClientTable(pops, { getSearchText: popSearchText })
  // undefined = closed, null = new POP, object = edit that POP.
  const [chosenPop, setChosenPop] = useState(undefined)
  // A row opens the left detail drawer; links inside it walk the network.
  const details = useDetailStack()
  const router = useRouter()

  // The map's drawer sends "Edit POP" here as `?edit=<id>`. Derived rather than
  // copied into state in an effect: the form opens once the list holds that
  // POP, and closing it dismisses that id so it does not spring back open.
  const editParamId = useSearchParams().get('edit')
  const [dismissedEditId, setDismissedEditId] = useState(null)
  const editParamPop =
    editParamId && editParamId !== dismissedEditId && canManage
      ? pops.find((p) => p.id === editParamId)
      : undefined
  const editingPop = chosenPop !== undefined ? chosenPop : editParamPop
  const setEditingPop = (pop) => {
    setChosenPop(pop)
    if (pop !== undefined) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeForm = () => {
    setChosenPop(undefined)
    if (editParamId) {
      setDismissedEditId(editParamId)
      // Tidy `?edit=` out of the address bar without re-running the route.
      window.history.replaceState(null, '', window.location.pathname)
    }
  }
  async function handleSave(values) {
    if (editingPop) {
      await apiClient.patch(`/pops/${editingPop.id}`, values)
    } else {
      await apiClient.post('/pops', values)
    }
    invalidatePops()
    invalidateFibers()
    closeForm()
  }

  async function handleDelete(pop) {
    if (!window.confirm(`Delete POP "${pop.name}"?`)) return
    setListError(null)
    try {
      await apiClient.delete(`/pops/${pop.id}`)
      invalidatePops()
      invalidateFibers()
      details.close()
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not delete this POP'))
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (p) => <span className="font-bold">{p.name}</span> },
    {
      key: 'zone',
      header: 'Zone',
      render: (p) => p.zone?.name ?? <span className="text-faint">No zone</span>,
    },
    {
      key: 'olts',
      header: 'OLTs',
      className: 'tabular-nums',
      render: (p) => oltCount(p) || <span className="text-faint">—</span>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (p) => <RowActions pop={p} onEdit={setEditingPop} onDelete={handleDelete} />,
          },
        ]
      : []),
  ]

  const renderCard = (p) => (
    <div
      className="flex items-center gap-2 rounded-card border-l-4 bg-card p-3 shadow-soft"
      style={{ borderLeftColor: POINT_COLORS.POP }}
    >
      <button
        type="button"
        onClick={() => details.open('pop', p.id)}
        className="min-w-0 flex-1 text-left transition-transform active:scale-[0.99]"
      >
        <span className="block truncate font-bold">{p.name}</span>
        <span className="block truncate text-sm font-normal text-muted">
          {p.zone?.name ?? 'No zone'} · {oltCount(p)} OLT{oltCount(p) === 1 ? '' : 's'}
        </span>
      </button>
      {canManage && <RowActions pop={p} onEdit={setEditingPop} onDelete={handleDelete} />}
    </div>
  )

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="POPs"
        sub={isAdmin ? 'Every site and its OLTs' : 'Sites in the zones you are assigned, and any you added'}
        backHref="/dashboard"
        backLabel="Dashboard"
        action={
          canManage && (
            <Button type="button" onClick={() => setEditingPop(null)}>
              <IconPlus className="h-4.5 w-4.5" />
              New POP
            </Button>
          )
        }
      />

      {listError && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      {editingPop !== undefined && (
        <div className="mb-4">
          <PopForm
            key={editingPop?.id ?? 'new'}
            initial={editingPop ? toForm(editingPop) : emptyForm}
            saveLabel={editingPop ? 'Save changes' : 'Add POP'}
            onCancel={closeForm}
            onSave={handleSave}
          />
        </div>
      )}

      <SearchInput
        value={table.search}
        onChange={table.onSearchChange}
        placeholder="Search POPs by name or zone…"
        className="mb-4"
      />

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={loading}
        keyField="id"
        onRowClick={(row) => details.open('pop', row.id)}
        renderCard={renderCard}
        emptyState={<p className="text-sm font-normal text-muted">No POPs yet — add the first one.</p>}
      />

      <Pagination pagination={table.pagination} onChange={table.onPageChange} />

      <DetailDrawer
        stack={details.stack}
        onOpen={details.push}
        onBack={details.back}
        onClose={details.close}
        onEditPop={(pop) => {
          details.close()
          setEditingPop(pops.find((p) => p.id === pop.id) ?? pop)
        }}
        onEditFiber={(fiber) => router.push(`/admin/fiber?edit=${fiber.id}`)}
      />
    </main>
  )
}

// useSearchParams must sit inside a Suspense boundary in the App Router.
export default function AdminPopsPageWithParams() {
  return (
    <Suspense fallback={null}>
      <AdminPopsPage />
    </Suspense>
  )
}
