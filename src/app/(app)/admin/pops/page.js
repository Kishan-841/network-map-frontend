'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { IconPlus, IconEdit, IconTrash } from '@/components/ui/icons'
import { usePops, invalidatePops } from '@/hooks/usePops'
import { invalidateFibers } from '@/hooks/useFibers'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import PopForm from '@/components/fiber/PopForm'
import OltList from '@/components/fiber/OltList'

const emptyForm = { name: '', latitude: '', longitude: '', notes: '' }

const toForm = (pop) => ({
  name: pop.name,
  latitude: String(pop.latitude),
  longitude: String(pop.longitude),
  notes: pop.notes ?? '',
})

const oltSummary = (pop) =>
  pop.olts?.length ? pop.olts.map((o) => `${o.name} (${o.ponPortCount})`).join(' · ') : '—'

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

export default function AdminPopsPage() {
  const canManage = canManageFiber(useAuthStore((s) => s.user))
  const { pops, loading } = usePops()
  const [listError, setListError] = useState(null)
  // undefined = closed, null = new POP, object = edit that POP.
  const [editingPop, setEditingPop] = useState(undefined)
  const [expandedId, setExpandedId] = useState(null)

  const closeForm = () => setEditingPop(undefined)
  const toggleExpand = (pop) => setExpandedId((id) => (id === pop.id ? null : pop.id))
  const onOltsMutated = () => {
    invalidatePops()
    invalidateFibers()
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
      if (expandedId === pop.id) setExpandedId(null)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not delete this POP'))
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (p) => <span className="font-bold">{p.name}</span> },
    {
      key: 'position',
      header: 'Position',
      className: 'font-mono text-xs text-muted',
      render: (p) => `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`,
    },
    { key: 'olts', header: 'OLTs', render: oltSummary },
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
    <div className="rounded-card bg-card p-4 shadow-soft">
      <div
        onClick={() => toggleExpand(p)}
        className="cursor-pointer transition-transform active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="truncate font-bold">{p.name}</span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
        </p>
        <p className="mt-1 text-sm font-normal text-muted">
          {oltSummary(p)}
        </p>
      </div>
      {canManage && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <RowActions pop={p} onEdit={setEditingPop} onDelete={handleDelete} />
        </div>
      )}
      {expandedId === p.id && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <OltList key={p.id} popId={p.id} olts={p.olts} canManage={canManage} onMutated={onOltsMutated} />
        </div>
      )}
    </div>
  )

  const expandedPop = pops.find((p) => p.id === expandedId) ?? null

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="POPs"
        sub="Sites and OLTs"
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

      <DataTable
        columns={columns}
        rows={pops}
        loading={loading}
        keyField="id"
        onRowClick={toggleExpand}
        renderCard={renderCard}
        emptyState={<p className="text-sm font-normal text-muted">No POPs yet — add the first one.</p>}
      />

      {/* Desktop-only — the mobile card above renders its sub-table inline. */}
      {expandedPop && (
        <div className="mt-4 hidden rounded-card bg-card p-5 shadow-soft lg:block">
          <h3 className="mb-3 text-sm font-bold text-ink">{expandedPop.name} · OLTs</h3>
          <OltList
            key={expandedPop.id}
            popId={expandedPop.id}
            olts={expandedPop.olts}
            canManage={canManage}
            onMutated={onOltsMutated}
          />
        </div>
      )}
    </main>
  )
}
