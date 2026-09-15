'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { IconPlus } from '@/components/ui/icons'
import { useFibers, invalidateFibers } from '@/hooks/useFibers'
import { FIBER_STATUS } from '@/lib/fiber/constants'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import FiberTable from '@/components/fiber/FiberTable'
import FiberDetailPanel from '@/components/fiber/FiberDetailPanel'
import JunctionsTool from '@/components/fiber/JunctionsTool'

// Client-only: Google Maps JS touches window.
const FiberEditor = dynamic(() => import('@/components/fiber/editor/FiberEditor'), {
  ssr: false,
})

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PLANNED', label: FIBER_STATUS.PLANNED.label },
  { value: 'LIVE', label: FIBER_STATUS.LIVE.label },
  { value: 'CUT', label: FIBER_STATUS.CUT.label },
]

function StatusFilterPills({ fibers, value, onChange }) {
  const countFor = (status) =>
    status === 'ALL' ? fibers.length : fibers.filter((f) => f.status === status).length

  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_FILTERS.map((filter) => {
        const active = value === filter.value
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter.value)}
            className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
              active
                ? 'border-fiber bg-fiber text-white'
                : 'border-line bg-card text-muted hover:text-ink'
            }`}
          >
            {filter.label} <span className="tabular-nums">{countFor(filter.value)}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function AdminFiberPage() {
  const role = useAuthStore((s) => s.user?.role)
  const canManage = canManageFiber(role)
  const { fibers, loading } = useFibers()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [panelFiberId, setPanelFiberId] = useState(null)
  // undefined = closed, null = new fiber, object = edit that fiber.
  const [editorFiber, setEditorFiber] = useState(undefined)
  const [listError, setListError] = useState(null)

  const filtered =
    statusFilter === 'ALL' ? fibers : fibers.filter((f) => f.status === statusFilter)

  const closeEditor = () => setEditorFiber(undefined)

  async function handleDelete(fiber) {
    if (!window.confirm(`Delete fiber "${fiber.name}"?`)) return
    setListError(null)
    try {
      await apiClient.delete(`/fibers/${fiber.id}`)
      invalidateFibers()
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not delete this fiber'))
    }
  }

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="Fibers"
        sub="Cables on the map"
        backHref="/dashboard"
        backLabel="Dashboard"
        action={
          canManage && (
            <Button type="button" onClick={() => setEditorFiber(null)}>
              <IconPlus className="h-4.5 w-4.5" />
              Draw new fiber
            </Button>
          )
        }
      />

      <div className="mb-4">
        <StatusFilterPills fibers={fibers} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {listError && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      <FiberTable
        fibers={filtered}
        loading={loading}
        canManage={canManage}
        onRowClick={(row) => setPanelFiberId(row.id)}
        onEdit={setEditorFiber}
        onDelete={handleDelete}
        emptyState={
          <p className="text-sm font-normal text-muted">No fibers yet — draw the first one.</p>
        }
      />

      {canManage && <JunctionsTool onMerged={() => {}} />}

      {panelFiberId && (
        <FiberDetailPanel
          key={panelFiberId}
          fiberId={panelFiberId}
          onClose={() => setPanelFiberId(null)}
          onEdit={(f) => {
            setPanelFiberId(null)
            setEditorFiber(f)
          }}
          onSwap={setPanelFiberId}
          onCentre={() => {}}
        />
      )}

      {editorFiber !== undefined && (
        <FiberEditor
          initialFiber={editorFiber ?? undefined}
          onClose={closeEditor}
          onSaved={(f) => {
            closeEditor()
            invalidateFibers()
            setPanelFiberId(f.id)
          }}
        />
      )}
    </main>
  )
}
