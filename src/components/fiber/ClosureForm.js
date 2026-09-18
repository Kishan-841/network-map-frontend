'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { CLOSURE_KINDS } from '@/lib/fiber/constants'
import { DEFAULT_CENTRE, parseLatitude, parseLongitude } from '@/lib/fiber/coords'

// Client-only: Google Maps JS touches window.
const GoogleLocationPicker = dynamic(
  () => import('@/components/map/google/GoogleLocationPicker'),
  { ssr: false },
)

/**
 * Create/edit form for a closure: position (typed or picked on the map),
 * kind, an optional building, and notes. `initial` is only ever read once —
 * the mount site keys this component fresh per edit target.
 */
export default function ClosureForm({ initial, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(() => initial)
  const [buildings, setBuildings] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

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
          disabled={!canSave}
          loading={busy}
          onClick={handleSave}
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
