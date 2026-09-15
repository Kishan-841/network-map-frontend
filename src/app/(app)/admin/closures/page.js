'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { IconPlus, IconEdit, IconTrash } from '@/components/ui/icons'
import { useClosures, invalidateClosures } from '@/hooks/useClosures'
import { invalidateFibers } from '@/hooks/useFibers'
import { RATIO_LABELS } from '@/lib/fiber/constants'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import ClosureForm from '@/components/fiber/ClosureForm'
import ClosurePopup from '@/components/fiber/ClosurePopup'
import FiberDetailPanel from '@/components/fiber/FiberDetailPanel'

const emptyForm = { latitude: '', longitude: '', kind: '', buildingId: '', notes: '' }

const toForm = (closure) => ({
  latitude: String(closure.latitude),
  longitude: String(closure.longitude),
  kind: closure.kind ?? '',
  buildingId: closure.building?.id ?? '',
  notes: closure.notes ?? '',
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
  const role = useAuthStore((s) => s.user?.role)
  const canManage = canManageFiber(role)
  const { closures, loading } = useClosures()
  const [listError, setListError] = useState(null)
  // undefined = closed, null = new closure, object = edit that closure.
  const [editingClosure, setEditingClosure] = useState(undefined)
  const [popupClosureId, setPopupClosureId] = useState(null)
  const [panelFiberId, setPanelFiberId] = useState(null)

  const closeForm = () => setEditingClosure(undefined)

  async function handleSave(values) {
    if (editingClosure) {
      await apiClient.patch(`/closures/${editingClosure.id}`, values)
    } else {
      await apiClient.post('/closures', values)
    }
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
    { key: 'kind', header: 'Kind', render: (c) => c.kind || '—' },
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
        <span className="shrink-0 text-xs font-medium text-muted">{c.kind || '—'}</span>
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
        sub="Splice boxes and splitters"
        backHref="/dashboard"
        backLabel="Dashboard"
        action={
          canManage && (
            <Button type="button" onClick={() => setEditingClosure(null)}>
              <IconPlus className="h-4.5 w-4.5" />
              New closure
            </Button>
          )
        }
      />

      {listError && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      {editingClosure !== undefined && (
        <div className="mb-4">
          <ClosureForm
            key={editingClosure?.id ?? 'new'}
            initial={editingClosure ? toForm(editingClosure) : emptyForm}
            saveLabel={editingClosure ? 'Save changes' : 'Add closure'}
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
        onRowClick={(row) => setPopupClosureId(row.id)}
        renderCard={renderCard}
        emptyState={
          <p className="text-sm font-normal text-muted">No closures yet — add the first one.</p>
        }
      />

      {popupClosureId && (
        <ClosurePopup
          key={popupClosureId}
          closureId={popupClosureId}
          onClose={() => setPopupClosureId(null)}
          onOpenFiber={(fiberId) => {
            setPopupClosureId(null)
            setPanelFiberId(fiberId)
          }}
        />
      )}

      {panelFiberId && (
        <FiberDetailPanel
          key={panelFiberId}
          fiberId={panelFiberId}
          onClose={() => setPanelFiberId(null)}
          onSwap={setPanelFiberId}
        />
      )}
    </main>
  )
}
