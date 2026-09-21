'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { ZoneSearchSelect } from '@/components/buildings/ZoneSearchSelect'
import { BuildingSearchField } from '@/components/fiber/BuildingSearchField'
import { useZones } from '@/hooks/useZones'
import { uploadFile } from '@/lib/upload'
import { DEFAULT_CENTRE, parseLatitude, parseLongitude } from '@/lib/fiber/coords'
import { equipmentPayload, RACK_SIZES, UPS_BATTERY_COUNTS } from '@/lib/fiber/pop-sheet'
import { PopEquipmentFields } from '@/components/fiber/PopEquipmentFields'

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
 * The zone decides who sees the site afterwards — everyone assigned to that
 * zone does, as does whoever adds it — so it is required. The zone list comes
 * from the API already scoped, which is what limits a surveyor to their own.
 */
export default function PopForm({ initial, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(() => initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const { zones, loading: zonesLoading } = useZones()

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handlePhotosPicked(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        const url = await uploadFile(file)
        setForm((f) => ({ ...f, images: [...(f.images ?? []), url] }))
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Photo upload failed'))
    } finally {
      setUploading(false)
    }
  }

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
        serverLocation: form.serverLocation.trim() || null,
        rackSize: form.rackSize || null,
        rackCondition: form.rackCondition || null,
        upsBatteryCount: form.upsBatteryCount ? Number(form.upsBatteryCount) : null,
        images: form.images ?? [],
        // The rack's contents go up with the POP: one save, one audit entry,
        // and a new POP never exists for a moment without its equipment.
        ...equipmentPayload({ olts: form.olts ?? [], devices: form.devices ?? [] }),
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

      {/* The rest of the survey sheet: what is in the rack and what state it
          is in. All optional — a POP can be dropped on the map in the field
          and filled in properly afterwards. */}
      <Input
        id="pop-server-location"
        label="Server location"
        placeholder="Where the rack stands — floor, room, building"
        value={form.serverLocation}
        onChange={set('serverLocation')}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select id="pop-rack-size" label="Rack size" value={form.rackSize} onChange={set('rackSize')}>
          <option value="">Not recorded</option>
          {RACK_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
        <Select
          id="pop-rack-condition"
          label="Rack condition"
          value={form.rackCondition}
          onChange={set('rackCondition')}
        >
          <option value="">Not recorded</option>
          <option value="OK">OK</option>
          <option value="DAMAGED">Damaged</option>
        </Select>
        <Select
          id="pop-ups-batteries"
          label="UPS batteries"
          value={form.upsBatteryCount}
          onChange={set('upsBatteryCount')}
        >
          <option value="">Not recorded</option>
          {UPS_BATTERY_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Server photos</p>
        <div className="flex flex-wrap items-center gap-2">
          {(form.images ?? []).map((url) => (
            <span key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Server rack"
                className="h-14 w-14 rounded-btn border border-line object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() =>
                  setForm((f) => ({ ...f, images: (f.images ?? []).filter((u) => u !== url) }))
                }
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bad text-[10px] font-bold text-white shadow"
              >
                ✕
              </button>
            </span>
          ))}
          <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-btn border border-dashed border-line text-xl text-muted transition-colors hover:border-fiber hover:text-fiber">
            {uploading ? <span className="loading loading-spinner loading-sm" /> : '+'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={handlePhotosPicked}
            />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
          What is in the rack
        </p>
        <PopEquipmentFields
          olts={form.olts ?? []}
          devices={form.devices ?? []}
          onChange={({ olts, devices }) => setForm((f) => ({ ...f, olts, devices }))}
        />
      </div>

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
