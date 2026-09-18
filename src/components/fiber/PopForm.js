'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ZoneSearchSelect } from '@/components/buildings/ZoneSearchSelect'
import { BuildingSearchField } from '@/components/fiber/BuildingSearchField'
import { useZones } from '@/hooks/useZones'
import { DEFAULT_CENTRE, parseLatitude, parseLongitude } from '@/lib/fiber/coords'

// Client-only: Google Maps JS touches window.
const GoogleLocationPicker = dynamic(
  () => import('@/components/map/google/GoogleLocationPicker'),
  { ssr: false },
)

/**
 * Create/edit form for a POP: name, the zone it sits in, position (searched,
 * typed, or picked on the map) and notes. `initial` is only ever read once —
 * the mount site keys this component fresh per edit target.
 *
 * The zone decides who can see the site afterwards, so it is required; the
 * list comes from the API already scoped, which is what limits a surveyor to
 * the zones they are assigned to.
 */
export default function PopForm({ initial, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(() => initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { zones, loading: zonesLoading } = useZones()

  const latitude = parseLatitude(form.latitude)
  const longitude = parseLongitude(form.longitude)
  const canSave = form.name.trim() && form.zoneId && latitude !== null && longitude !== null

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await onSave({
        name: form.name.trim(),
        zoneId: form.zoneId,
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

      <ZoneSearchSelect
        id="pop-zone"
        zones={zones}
        value={form.zoneId}
        disabled={zonesLoading}
        onChange={(zoneId) => setForm((f) => ({ ...f, zoneId }))}
      />

      {/* Most POPs sit in or beside a building somebody has already surveyed —
          picking it drops the pin on coordinates that were checked on site. */}
      <BuildingSearchField
        onPick={({ latitude: lat, longitude: lng, name }) =>
          setForm((f) => ({
            ...f,
            latitude: String(lat),
            longitude: String(lng),
            name: f.name.trim() ? f.name : name,
          }))
        }
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
        searchable
        latitude={latitude ?? DEFAULT_CENTRE.latitude}
        longitude={longitude ?? DEFAULT_CENTRE.longitude}
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
