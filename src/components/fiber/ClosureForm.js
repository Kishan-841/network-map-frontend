'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { CLOSURE_KINDS } from '@/lib/fiber/constants'
import { cablesPayload, cablesToForm } from '@/lib/fiber/closure-cables'
import { DEFAULT_CENTRE, parseLatitude, parseLongitude } from '@/lib/fiber/coords'
import ClosurePhotos from '@/components/fiber/ClosurePhotos'
import ClosureCablesEditor from '@/components/fiber/ClosureCablesEditor'

// Client-only: Google Maps JS touches window.
const GoogleLocationPicker = dynamic(
  () => import('@/components/map/google/GoogleLocationPicker'),
  { ssr: false },
)

/** A saved closure as the form's string fields (used by the Closures page and the drawer). */
export const closureToForm = (closure) => ({
  latitude: String(closure.latitude),
  longitude: String(closure.longitude),
  kind: closure.kind ?? '',
  buildingId: closure.building?.id ?? '',
  notes: closure.notes ?? '',
  cables: cablesToForm(closure.cables),
  images: closure.images ?? [],
})

/**
 * Create/edit form for a closure: position (typed or picked on the map),
 * kind, its In / Out cables, an optional building, and notes. `initial` is only ever read once —
 * the mount site keys this component fresh per edit target.
 */
export default function ClosureForm({ initial, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(() => initial)
  const [buildings, setBuildings] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const setImages = (update) => setForm((f) => ({ ...f, images: update(f.images ?? []) }))

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/buildings/markers')
      .then((res) => !cancelled && setBuildings(res.data.data))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const latitude = parseLatitude(form.latitude)
  const longitude = parseLongitude(form.longitude)
  const canSave = latitude !== null && longitude !== null

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await onSave({
        latitude,
        longitude,
        kind: form.kind.trim() || null,
        buildingId: form.buildingId || null,
        notes: form.notes.trim() || null,
        // The whole list, every save: it replaces the closure's stored cables.
        cables: cablesPayload(form.cables ?? []),
        // The whole list, every save: an empty list clears the photos.
        images: form.images ?? [],
      })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-soft">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="closure-lat"
          label="Latitude"
          inputMode="decimal"
          placeholder="e.g. 18.6018"
          value={form.latitude}
          onChange={(e) => setForm({ ...form, latitude: e.target.value })}
        />
        <Input
          id="closure-lng"
          label="Longitude"
          inputMode="decimal"
          placeholder="e.g. 73.7542"
          value={form.longitude}
          onChange={(e) => setForm({ ...form, longitude: e.target.value })}
        />
      </div>

      <GoogleLocationPicker
        latitude={latitude ?? DEFAULT_CENTRE.latitude}
        longitude={longitude ?? DEFAULT_CENTRE.longitude}
        onChange={({ latitude, longitude }) =>
          setForm((f) => ({ ...f, latitude: String(latitude), longitude: String(longitude) }))
        }
      />

      {/* The same three the editor offers, so a closure cannot end up with a
          kind nobody else uses. A closure recorded with an older word keeps it
          as its own option rather than being silently renamed. */}
      <Select
        id="closure-kind"
        label="Kind"
        value={form.kind}
        onChange={(e) => setForm({ ...form, kind: e.target.value })}
      >
        <option value="">No kind</option>
        {CLOSURE_KINDS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {form.kind && !CLOSURE_KINDS.some((option) => option.value === form.kind) && (
          <option value={form.kind}>{form.kind}</option>
        )}
      </Select>

      {/* The survey sheet: every cable coming In and going Out, each with its
          type, cores and the fiber ID written on it. All optional — often
          filled in on a later visit. */}
      <ClosureCablesEditor
        cables={form.cables ?? []}
        onChange={(cables) => setForm((f) => ({ ...f, cables }))}
        disabled={busy}
      />

      <Select
        id="closure-building"
        label="Building"
        value={form.buildingId}
        onChange={(e) => setForm({ ...form, buildingId: e.target.value })}
      >
        <option value="">No building</option>
        {buildings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.buildingName}
          </option>
        ))}
      </Select>

      <Textarea
        id="closure-notes"
        label="Notes"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />

      <ClosurePhotos images={form.images} setImages={setImages} onUploadingChange={setUploading} />

      {/* Pinned to the bottom of the screen so Save is always in reach — above
          the mobile bottom-nav, flush at the card's foot on desktop. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-5 -mb-5 mt-1 flex flex-col gap-3 rounded-b-card border-t border-line bg-card px-5 py-4 lg:bottom-0">
        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}
        <div className="flex gap-3">
          {onCancel && (
            <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            className="flex-1"
            disabled={!canSave || uploading}
            loading={busy}
            onClick={handleSave}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
