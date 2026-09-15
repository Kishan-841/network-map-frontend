'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'

// Client-only: Google Maps JS touches window.
const GoogleLocationPicker = dynamic(
  () => import('@/components/map/google/GoogleLocationPicker'),
  { ssr: false },
)

// India, country-level fallback — same default used by every other map here.
const DEFAULT_CENTER = { latitude: 20.5937, longitude: 78.9629 }

function parseCoord(value, min, max) {
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

/**
 * Create/edit form for a POP: name, position (typed or picked on the map),
 * and notes. `initial` is only ever read once — the mount site keys this
 * component fresh per edit target.
 */
export default function PopForm({ initial, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(() => initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const latitude = parseCoord(form.latitude, -90, 90)
  const longitude = parseCoord(form.longitude, -180, 180)
  const canSave = form.name.trim() && latitude !== null && longitude !== null

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await onSave({
        name: form.name.trim(),
        latitude,
        longitude,
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
      <Input
        id="pop-name"
        label="Name"
        placeholder="POP name e.g. Wakad POP-1"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="pop-lat"
          label="Latitude"
          inputMode="decimal"
          placeholder="e.g. 18.6018"
          value={form.latitude}
          onChange={(e) => setForm({ ...form, latitude: e.target.value })}
        />
        <Input
          id="pop-lng"
          label="Longitude"
          inputMode="decimal"
          placeholder="e.g. 73.7542"
          value={form.longitude}
          onChange={(e) => setForm({ ...form, longitude: e.target.value })}
        />
      </div>

      <GoogleLocationPicker
        latitude={latitude ?? DEFAULT_CENTER.latitude}
        longitude={longitude ?? DEFAULT_CENTER.longitude}
        onChange={({ latitude, longitude }) =>
          setForm((f) => ({ ...f, latitude: String(latitude), longitude: String(longitude) }))
        }
      />

      <Textarea
        id="pop-notes"
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
