'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BoundaryEditor, parseBoundaryPoints } from '@/components/admin/BoundaryEditor'
import { ImportZonesModal } from '@/components/admin/ImportZonesModal'
import { IconEdit, IconTrash, IconPin, IconUpload } from '@/components/ui/icons'

const emptyForm = { name: '', city: '', points: [] }

function toFormPoints(boundary) {
  return (boundary ?? []).map((point) => ({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
  }))
}

/** Shared create/edit form: name, city, optional polygon boundary. */
function ZoneForm({ initial, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const parsedBoundary = parseBoundaryPoints(form.points)
  const boundaryValid =
    form.points.length === 0 || (parsedBoundary !== null && form.points.length >= 3)
  const canSave = form.name.trim() && form.city.trim() && boundaryValid

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await onSave({
        name: form.name.trim(),
        city: form.city.trim(),
        boundary: form.points.length === 0 ? null : parsedBoundary,
      })
    } catch (err) {
      setError(getApiErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-soft">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="zone-name"
          placeholder="Zone name e.g. Wakad West"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          id="zone-city"
          placeholder="City e.g. Pune"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
      </div>

      <BoundaryEditor points={form.points} onChange={(points) => setForm({ ...form, points })} />

      {form.points.length > 0 && !boundaryValid && (
        <p className="text-sm font-normal text-warn">
          Enter valid coordinates for every point (at least 3 points).
        </p>
      )}
      {error && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <Button variant="secondary" fullWidth onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button fullWidth disabled={!canSave} loading={busy} onClick={handleSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}

export default function AdminZonesPage() {
  const [zones, setZones] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [listError, setListError] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const fetchZones = useCallback(
    () => apiClient.get('/zones').then((res) => setZones(res.data.data)),
    [],
  )

  useEffect(() => {
    fetchZones()
  }, [fetchZones])

  async function handleDelete(zone) {
    if (!window.confirm(`Delete "${zone.name}"?`)) return
    setListError(null)
    try {
      await apiClient.delete(`/zones/${zone.id}`)
      await fetchZones()
    } catch (err) {
      setListError(getApiErrorMessage(err))
    }
  }

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Administration"
        title="Zones"
        sub="Coverage areas — add a boundary to draw the zone on the map"
        backHref="/admin"
        backLabel="Dashboard"
      />

      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-2 rounded-btn border border-line bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-fiber/50"
        >
          <IconUpload className="h-4 w-4" /> Import from Excel
        </button>
      </div>

      <ZoneForm
        initial={emptyForm}
        saveLabel="Add zone"
        onSave={async (payload) => {
          await apiClient.post('/zones', payload)
          await fetchZones()
        }}
      />

      {listError && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {zones === null && <p className="text-sm font-normal text-muted">Loading…</p>}
        {zones?.map((zone) =>
          editingId === zone.id ? (
            <ZoneForm
              key={zone.id}
              initial={{ name: zone.name, city: zone.city, points: toFormPoints(zone.boundary) }}
              saveLabel="Save changes"
              onCancel={() => setEditingId(null)}
              onSave={async (payload) => {
                await apiClient.patch(`/zones/${zone.id}`, payload)
                setEditingId(null)
                await fetchZones()
              }}
            />
          ) : (
            <div
              key={zone.id}
              className="flex items-center justify-between gap-3 rounded-card bg-card p-4 shadow-soft"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{zone.name}</p>
                <p className="truncate text-sm font-normal text-muted">{zone.city}</p>
                {zone.boundary?.length >= 3 && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-fiber-tint px-2.5 py-0.5 text-xs font-medium text-fiber">
                    <IconPin className="h-3 w-3" /> {zone.boundary.length}-point boundary
                  </p>
                )}
              </div>
              <button
                aria-label="Edit"
                onClick={() => setEditingId(zone.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper hover:text-ink"
              >
                <IconEdit className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
              <button
                aria-label="Delete"
                onClick={() => handleDelete(zone)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-bad-tint hover:text-bad"
              >
                <IconTrash className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </div>
          ),
        )}
      </div>

      <ImportZonesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchZones}
      />
    </main>
  )
}
