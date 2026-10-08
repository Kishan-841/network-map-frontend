'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import LocationPicker from '@/components/map/LocationPicker'
import { getMapProvider } from '@/lib/map-providers'
import { uploadFile } from '@/lib/upload'
import { DESIGNATIONS } from '@/lib/roles'
import { DEFAULT_CENTRE, parseLatitude, parseLongitude } from '@/lib/fiber/coords'
import {
  buildSocietyPayload,
  societyFormErrors,
  PERMISSION_STATUS_OPTIONS,
  SOCIETY_OFFER_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
} from '@/lib/society'

const EMPTY = {
  buildingName: '', formattedAddress: '', placeId: null, latitude: '', longitude: '', zoneId: '',
  wings: '', floors: '', homePass: '',
  contactName: '', contactPhone: '', designation: 'SECRETARY', designationOther: '', contactEmail: '',
  permissionStatus: '', societyOffer: '', paymentType: '', amountPaid: '', demoCount: '',
  permissionLetterUrl: '', entrancePhotoUrl: '',
  remark: '',
}

/**
 * Capture / edit one society for a Permission Executive. The searchable map
 * sets the coordinates (search moves the pin, drag to refine); the zone is
 * guessed from the pin and can be overridden. Errors are held until the first
 * save, then shown live. `onSave` receives the POST /buildings body.
 */
export default function SocietyForm({
  initial,
  onSave,
  saveLabel = 'Save society',
  remarkLabel = 'What happened on this visit?',
}) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial }))
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState('')

  const validation = societyFormErrors(form)
  const show = attempted ? validation.fields : {}
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const lat = parseLatitude(form.latitude)
  const lng = parseLongitude(form.longitude)

  // Moving the pin (search or drag) sets the coordinates and auto-fills the
  // address from the geocoding API — the executive never types it.
  async function onPin({ latitude, longitude }) {
    setForm((f) => ({ ...f, latitude: String(latitude), longitude: String(longitude) }))
    // The address is read-only and required, so it must never end up empty:
    // use the reverse-geocoded address, or the coordinates as a last resort.
    // The building name is auto-captured from the same place when there is one.
    const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    try {
      const place = await getMapProvider().reverseGeocode({ latitude, longitude })
      const name = place.buildingName || place.premise || place.name || ''
      setForm((f) => ({
        ...f,
        formattedAddress: place.formattedAddress || coords,
        buildingName: name || f.buildingName,
      }))
    } catch {
      setForm((f) => ({ ...f, formattedAddress: f.formattedAddress || coords }))
    }
  }

  async function upload(key, file) {
    if (!file) return
    setUploading(key)
    setError(null)
    try {
      const url = await uploadFile(file)
      setForm((f) => ({ ...f, [key]: url }))
    } catch {
      setError('Upload failed — try again')
    } finally {
      setUploading('')
    }
  }

  async function submit() {
    if (!validation.ok) {
      setAttempted(true)
      setError('Fix the highlighted fields before saving.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave(buildSocietyPayload({ ...form, latitude: lat, longitude: lng }))
    } catch (err) {
      setError(err?.message ?? 'Could not save the society')
    } finally {
      setBusy(false)
    }
  }

  const isPayment = form.societyOffer === 'PAYMENT'
  const isDemo = form.societyOffer === 'DEMO'

  return (
    <div className="flex flex-col gap-4 rounded-card bg-card p-5 shadow-soft">
      {/* Location */}
      <div>
        <p className="mb-1 text-sm font-medium text-ink">Find the building on the map</p>
        <LocationPicker
          searchable
          latitude={lat ?? DEFAULT_CENTRE.latitude}
          longitude={lng ?? DEFAULT_CENTRE.longitude}
          onChange={onPin}
        />
        {show.location && <p className="mt-1.5 text-sm font-normal text-bad">{show.location}</p>}
      </div>
      {/* Society */}
      <Input id="s-name" label="Building name" value={form.buildingName} error={show.buildingName} onChange={set('buildingName')} />
      <Input
        id="s-address"
        label="Address (from the map)"
        value={form.formattedAddress}
        readOnly
        placeholder="Search or move the pin to fill the address"
      />
      <div className="grid grid-cols-3 gap-3">
        <Input id="s-wing" label="Wing" value={form.wings} onChange={set('wings')} />
        <Input id="s-floor" label="Floor" value={form.floors} onChange={set('floors')} />
        <Input id="s-homepass" label="Home pass" inputMode="numeric" value={form.homePass} onChange={set('homePass')} />
      </div>

      {/* Met person */}
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-faint">Person you met</p>
      <Input id="s-cname" label="Name" value={form.contactName} error={show.contactName} onChange={set('contactName')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input id="s-cphone" label="Contact no" type="tel" inputMode="tel" value={form.contactPhone} error={show.contactPhone} onChange={set('contactPhone')} />
        <Select id="s-desg" label="Designation" value={form.designation} onChange={set('designation')}>
          {DESIGNATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
      </div>
      {form.designation === 'OTHER' && (
        <Input id="s-desg-other" label="Describe the designation" value={form.designationOther} onChange={set('designationOther')} />
      )}
      <Input id="s-email" label="Email (optional)" type="email" value={form.contactEmail} onChange={set('contactEmail')} />

      {/* Permission */}
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-faint">Permission</p>
      <Select id="s-status" label="Permission" value={form.permissionStatus} error={show.permissionStatus} onChange={set('permissionStatus')}>
        <option value="">Choose the outcome…</option>
        {PERMISSION_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UploadField id="s-letter" label="Permission letter" url={form.permissionLetterUrl} busy={uploading === 'permissionLetterUrl'} onFile={(f) => upload('permissionLetterUrl', f)} />
        <UploadField id="s-photo" label="Photo" url={form.entrancePhotoUrl} busy={uploading === 'entrancePhotoUrl'} onFile={(f) => upload('entrancePhotoUrl', f)} />
      </div>

      {/* Society offer */}
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-faint">Society offers</p>
      <Select id="s-offer" label="Offer" value={form.societyOffer} onChange={set('societyOffer')}>
        <option value="">Not recorded</option>
        {SOCIETY_OFFER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {isPayment && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select id="s-ptype" label="Payment" value={form.paymentType} onChange={set('paymentType')}>
            <option value="">Choose…</option>
            {PAYMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input id="s-amount" label="Amount (₹)" inputMode="numeric" value={form.amountPaid} onChange={set('amountPaid')} />
        </div>
      )}
      {isDemo && (
        <Input id="s-demo" label="Demo connections" inputMode="numeric" value={form.demoCount} onChange={set('demoCount')} />
      )}

      {/* Remark — compulsory on every add and edit; it heads the history entry. */}
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-faint">Remark</p>
      <Textarea
        id="s-remark"
        label={remarkLabel}
        rows={3}
        maxLength={1000}
        value={form.remark}
        error={show.remark}
        onChange={set('remark')}
        placeholder="e.g. Met the secretary — committee meets on Sunday"
      />

      {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
      <Button type="button" loading={busy} onClick={submit}>
        {saveLabel}
      </Button>
    </div>
  )
}

function UploadField({ id, label, url, busy, onFile }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-muted">{label}</p>
      <label className="flex cursor-pointer items-center gap-2 rounded-btn border border-dashed border-line px-3 py-2 text-sm text-muted transition-colors hover:border-fiber hover:text-fiber">
        {busy ? <span className="loading loading-spinner loading-xs" /> : null}
        {url ? 'Replace file' : 'Upload'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            onFile(file)
          }}
        />
      </label>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="mt-2 h-16 w-16 rounded-btn border border-line object-cover" />
      )}
    </div>
  )
}
