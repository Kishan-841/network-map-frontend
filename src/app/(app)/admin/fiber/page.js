'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { IconEdit, IconTrash, IconPlus } from '@/components/ui/icons'

// Client-only: Google Maps JS touches window.
const GoogleFiberEditor = dynamic(() => import('@/components/map/google/GoogleFiberEditor'), {
  ssr: false,
})

export default function AdminFiberPage() {
  const [routes, setRoutes] = useState(null)
  const [listError, setListError] = useState(null)
  // undefined = closed, null = new route, object = edit that route.
  const [editorRoute, setEditorRoute] = useState(undefined)

  const fetchRoutes = useCallback(
    () =>
      apiClient
        .get('/fiber-routes')
        .then((res) => setRoutes(res.data.data))
        // Empty list (not a permanent "Loading…") when the fetch fails.
        .catch(() => setRoutes([])),
    [],
  )

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  async function handleDelete(route) {
    if (!window.confirm(`Delete fiber route "${route.name}"?`)) return
    setListError(null)
    try {
      await apiClient.delete(`/fiber-routes/${route.id}`)
      fetchRoutes()
    } catch (err) {
      setListError(getApiErrorMessage(err))
    }
  }

  const segmentCount = (route) => route.segments?.length ?? 0
  const pointCount = (route) =>
    (route.segments ?? []).reduce((sum, segment) => sum + segment.length, 0)

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Administration"
        title="Fiber routes"
        sub="Draw the physical fiber network on the map — trunks and branches"
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <Button onClick={() => setEditorRoute(null)}>
        <IconPlus className="h-4.5 w-4.5" />
        Draw new route
      </Button>

      {listError && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {routes === null && <p className="text-sm font-normal text-muted">Loading…</p>}
        {routes?.length === 0 && (
          <p className="text-sm font-normal text-muted">
            No fiber routes yet — draw the first one.
          </p>
        )}
        {routes?.map((route) => (
          <div
            key={route.id}
            className="flex items-center justify-between gap-3 rounded-card bg-card p-4 shadow-soft"
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: route.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{route.name}</p>
              <p className="text-sm font-normal text-muted">
                {segmentCount(route)} line{segmentCount(route) === 1 ? '' : 's'} ·{' '}
                {pointCount(route)} points
                {route.fiberType && ` · ${route.fiberType}`}
                {route.placement && ` · ${route.placement}`}
                {route.fiberId && ` · ${route.fiberId}`}
              </p>
            </div>
            <button
              aria-label="Edit"
              onClick={() => setEditorRoute(route)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
            >
              <IconEdit className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
            <button
              aria-label="Delete"
              onClick={() => handleDelete(route)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-bad-tint hover:text-bad"
            >
              <IconTrash className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>

      {editorRoute !== undefined && (
        <GoogleFiberEditor
          initialRoute={editorRoute ?? undefined}
          onClose={() => setEditorRoute(undefined)}
          onSaved={() => {
            setEditorRoute(undefined)
            fetchRoutes()
          }}
        />
      )}
    </main>
  )
}
