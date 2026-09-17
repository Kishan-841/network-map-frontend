'use client'

import { Suspense, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { IconPlus } from '@/components/ui/icons'
import { useFibers, invalidateFibers } from '@/hooks/useFibers'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import FiberTable from '@/components/fiber/FiberTable'
import FiberDetailPanel from '@/components/fiber/FiberDetailPanel'

// Client-only: Google Maps JS touches window.
const FiberEditor = dynamic(() => import('@/components/fiber/editor/FiberEditor'), {
  ssr: false,
})

function AdminFiberContent() {
  // The map's fiber panel sends "Edit" here as `?edit=<id>`: the editor is a
  // full-screen tool that only lives on this page.
  const editParamId = useSearchParams().get('edit')
  const canManage = canManageFiber(useAuthStore((s) => s.user))
  const { fibers, loading } = useFibers()
  const [panelFiberId, setPanelFiberId] = useState(null)
  // undefined = closed, null = new fiber, object = edit that fiber.
  const [editorFiber, setEditorFiber] = useState(undefined)
  const [listError, setListError] = useState(null)

  // Derived, never stored: the editor opens for `?edit=` as soon as the fibers
  // list contains that id. Closing records WHICH id was dismissed — dropping
  // the param is what really closes it, and this covers the render in between
  // without ever pinning a different `?edit=` shut.
  const [dismissedEditId, setDismissedEditId] = useState(null)
  const editParamFiber =
    editParamId && editParamId !== dismissedEditId && canManage
      ? fibers.find((f) => f.id === editParamId)
      : undefined
  const editorOpen = editorFiber !== undefined || Boolean(editParamFiber)
  const editorInitialFiber = editorFiber !== undefined ? (editorFiber ?? undefined) : editParamFiber

  // The editor now closes itself (Done) after it has saved everything it
  // wanted to save — refresh the table on the way out.
  const closeEditor = () => {
    setEditorFiber(undefined)
    invalidateFibers()
    if (editParamId) {
      setDismissedEditId(editParamId)
      // Tidy `?edit=` out of the address bar. The native History API (which
      // Next syncs with useSearchParams) rather than router.replace: this is a
      // UI-only param, and a router navigation re-runs the route for nothing.
      window.history.replaceState(null, '', '/admin/fiber')
    }
  }

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

      {listError && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      <FiberTable
        fibers={fibers}
        loading={loading}
        canManage={canManage}
        onRowClick={(row) => setPanelFiberId(row.id)}
        onEdit={setEditorFiber}
        onDelete={handleDelete}
        emptyState={
          <p className="text-sm font-normal text-muted">No fibers yet — draw the first one.</p>
        }
      />

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

      {editorOpen && (
        <FiberEditor
          initialFiber={editorInitialFiber}
          onClose={closeEditor}
          // A save keeps the editor open (it moves on to closures) — the list
          // behind it just needs to know the row changed.
          onSaved={() => invalidateFibers()}
        />
      )}
    </main>
  )
}

// useSearchParams must sit inside a Suspense boundary in the App Router.
export default function AdminFiberPage() {
  return (
    <Suspense fallback={null}>
      <AdminFiberContent />
    </Suspense>
  )
}
