'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { IconEdit, IconTrash } from '@/components/ui/icons'
import { useClosures, invalidateClosures } from '@/hooks/useClosures'
import { invalidateFibers } from '@/hooks/useFibers'
import { RATIO_LABELS, closureKindLabel } from '@/lib/fiber/constants'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import ClosureForm from '@/components/fiber/ClosureForm'
import DetailDrawer from '@/components/fiber/details/DetailDrawer'
import { useDetailStack } from '@/components/fiber/details/useDetailStack'

const toForm = (closure) => ({
  latitude: String(closure.latitude),
  longitude: String(closure.longitude),
  kind: closure.kind ?? '',
  buildingId: closure.building?.id ?? '',
  notes: closure.notes ?? '',
  fiberType: closure.fiberType ?? '',
  tubeCount: closure.tubeCount == null ? '' : String(closure.tubeCount),
  inCoreCount: closure.inCoreCount == null ? '' : String(closure.inCoreCount),
  outCoreCount: closure.outCoreCount == null ? '' : String(closure.outCoreCount),
})

const splitterLabel = (closure) =>
  closure.splitters?.length
    ? closure.splitters.map((s) => RATIO_LABELS[s.ratio] ?? s.ratio).join(' · ')
    : '—'

const fiberCount = (closure) => closure._count?.points ?? closure.fiberCount ?? '—'

function RowActions({ closure, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        aria-label="Edit"
        onClick={(e) => {
          e.stopPropagation()
          onEdit(closure)
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
          onDelete(closure)
        }}
        className="flex h-9 w-9 min-h-11 items-center justify-center rounded-btn text-muted transition-colors hover:bg-bad-tint hover:text-bad"
      >
        <IconTrash className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </div>
  )
}

export default function AdminClosuresPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = canManageFiber(user)
  // Only the maker and an ADMIN see a row, so say whose list this is.
  const isAdmin = user?.role === 'ADMIN'
  const { closures, loading } = useClosures()
  const [listError, setListError] = useState(null)
  // Closures are only ever created from the fiber editor, as a point on a
  // line — this page edits and removes them. null = form closed.
  const [editingClosure, setEditingClosure] = useState(null)
  const router = useRouter()
  // A row opens the left detail drawer; links inside it walk the network.
  const details = useDetailStack()

  const closeForm = () => setEditingClosure(null)

  async function handleSave(values) {
    await apiClient.patch(`/closures/${editingClosure.id}`, values)
    invalidateClosures()
    invalidateFibers()
    closeForm()
  }

  async function handleDelete(closure) {
    if (!window.confirm(`Delete closure "${closure.code}"?`)) return
    setListError(null)
    try {
      await apiClient.delete(`/closures/${closure.id}`)
      invalidateClosures()
      invalidateFibers()
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not delete this closure'))
    }
  }

  const columns = [
    { key: 'code', header: 'Code', render: (c) => <span className="font-mono font-bold">{c.code}</span> },
    {
      key: 'position',
      header: 'Position',
      className: 'font-mono text-xs text-muted',
      render: (c) => `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`,
    },
    { key: 'kind', header: 'Kind', render: (c) => closureKindLabel(c.kind) || '—' },
    { key: 'building', header: 'Building', render: (c) => c.building?.buildingName ?? '—' },
    { key: 'fibers', header: 'Fibers', className: 'tabular-nums', render: fiberCount },
    { key: 'splitters', header: 'Splitters', render: splitterLabel },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (c) => <RowActions closure={c} onEdit={setEditingClosure} onDelete={handleDelete} />,
          },
        ]
      : []),
  ]

  const renderCard = (c) => (
    <div
      onClick={() => setPopupClosureId(c.id)}
      className="cursor-pointer rounded-card bg-card p-4 shadow-soft transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="truncate font-mono font-bold">{c.code}</span>
        <span className="shrink-0 text-xs font-medium text-muted">
          {closureKindLabel(c.kind) || '—'}
        </span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted">
        {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
      </p>
      <p className="mt-1 text-sm font-normal text-muted">
        {c.building?.buildingName ?? 'No building'} · {fiberCount(c)} fiber
        {fiberCount(c) === 1 ? '' : 's'} · {splitterLabel(c)}
      </p>
      {canManage && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <RowActions closure={c} onEdit={setEditingClosure} onDelete={handleDelete} />
        </div>
      )}
    </div>
  )

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="Closures"
        sub={isAdmin ? 'Every splice box and splitter' : 'The ones on your own cables — only you and admins see them'}
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      {listError && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      {editingClosure && (
        <div className="mb-4">
          <ClosureForm
            key={editingClosure.id}
            initial={toForm(editingClosure)}
            saveLabel="Save changes"
            onCancel={closeForm}
            onSave={handleSave}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={closures}
        loading={loading}
        keyField="id"
        onRowClick={(row) => details.open('closure', row.id)}
        renderCard={renderCard}
        emptyState={
          <p className="text-sm font-normal text-muted">No closures yet. Add one by placing it on a fiber line in the fiber editor.</p>
        }
      />

      <DetailDrawer
        stack={details.stack}
        onOpen={details.push}
        onBack={details.back}
        onClose={details.close}
        onEditFiber={(fiber) => router.push(`/admin/fiber?edit=${fiber.id}`)}
        onEditPop={(pop) => router.push(`/admin/pops?edit=${pop.id}`)}
      />
    </main>
  )
}
