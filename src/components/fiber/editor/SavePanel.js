'use client'

import { useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { uploadFile } from '@/lib/upload'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { ZoneSearchSelect } from '@/components/buildings/ZoneSearchSelect'
import { useFibers, invalidateFibers } from '@/hooks/useFibers'
import { useZones } from '@/hooks/useZones'
import { useOperators } from '@/hooks/useOperators'
import { invalidatePops } from '@/hooks/usePops'
import { invalidateClosures } from '@/hooks/useClosures'
import { toPayloadPoints } from '@/lib/fiber/draft'
import { coreColor, FIBER_TYPES } from '@/lib/fiber/constants'
import { guessZoneId } from '@/lib/fiber/zone-guess'
import BottomSheet, { SHEET_DIALOG } from './BottomSheet'

const PLACEMENT_CHOICES = [
  { value: 'IN', label: 'IN' },
  { value: 'OUT', label: 'OUT' },
  { value: null, label: '—' },
]

/**
 * The short "Save fiber" form: zone, operator, route name, fiber ID, type,
 * IN/OUT,
 * remark and photos — everything a surveyor knows at the moment the line is
 * drawn.
 *
 * The zone is required: the map's zone filter can only be trusted if every
 * fiber carries one. It is pre-filled from where the line starts, and the
 * operator from that zone's operator — both stay editable, and the API
 * re-checks whatever is sent (a surveyor may only use their own zones).
 * Creating sends the drawn points with it; editing only touches the details
 * (the editor's own "Save changes" owns the point list). OLT / PON port /
 * status / cable type stay in the database and out of this dialog.
 */
export default function SavePanel({ mode, fiber, draftPoints, coreCount, onSaved, onBack }) {
  const { fibers } = useFibers()
  // Already scoped by the API: a surveyor's list is their assigned zones.
  const { zones, loading: zonesLoading } = useZones()
  const { operators } = useOperators()

  // null means "nothing chosen yet, use the suggestion"; '' means the reader
  // deliberately cleared it. Derived rather than set in an effect, so the
  // suggestion can appear the moment the zones land without a second render.
  const [zonePick, setZonePick] = useState(() => fiber?.zoneId ?? null)
  const [operatorPick, setOperatorPick] = useState(() => fiber?.operatorId ?? null)
  const suggestedZoneId = useMemo(
    () => (mode === 'edit' ? null : guessZoneId(zones, draftPoints)),
    [mode, zones, draftPoints],
  )
  const zoneId = zonePick ?? suggestedZoneId ?? ''
  const zoneOperatorId = zones.find((zone) => zone.id === zoneId)?.operatorId ?? null
  const operatorId = operatorPick ?? zoneOperatorId ?? ''

  const [name, setName] = useState(() => fiber?.name ?? '')
  const [cableTag, setCableTag] = useState(() => fiber?.cableTag ?? '')
  const [cableType, setCableType] = useState(() => fiber?.cableType ?? '')
  const [placement, setPlacement] = useState(() => fiber?.placement ?? null)
  const [notes, setNotes] = useState(() => fiber?.notes ?? '')
  const [images, setImages] = useState(() => fiber?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const namePlaceholder = `Auto — FIB-${String(fibers.length + 1).padStart(3, '0')}`

  async function handleImagesPicked(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        const url = await uploadFile(file)
        setImages((prev) => [...prev, url])
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Image upload failed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        coreCount,
        cableTag: cableTag.trim() || null,
        cableType: cableType || null,
        notes: notes.trim() || null,
        images,
        placement,
        zoneId,
        operatorId: operatorId || null,
      }
      const trimmedName = name.trim()
      if (trimmedName) payload.name = trimmedName
      // Only a new fiber carries its geometry here — an edit is details-only.
      if (mode !== 'edit') payload.points = toPayloadPoints(draftPoints)

      const res =
        mode === 'edit'
          ? await apiClient.patch(`/fibers/${fiber.id}`, payload)
          : await apiClient.post('/fibers', payload)

      invalidateFibers()
      invalidateClosures()
      invalidatePops()
      onSaved(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const nameBlank = name.length > 0 && !name.trim()
  // A new fiber must say which zone it runs in; an edit keeps whatever it has.
  const zoneMissing = mode !== 'edit' && !zoneId

  return (
    <BottomSheet desktop={SHEET_DIALOG} backdrop onBackdropClick={saving ? undefined : onBack} className="gap-4">
      <h2 className="text-base font-bold">{mode === 'edit' ? 'Fiber details' : 'Save fiber'}</h2>

      <ZoneSearchSelect
        id="fiber-zone"
        zones={zones}
        value={zoneId}
        disabled={zonesLoading}
        onChange={(id) => {
          setZonePick(id)
          // Follow the new zone's operator unless one was picked by hand.
          if (operatorPick === null) setOperatorPick(null)
        }}
      />

      {operators.length > 0 && (
        <Select
          id="fiber-operator"
          label="Operator"
          value={operatorId}
          onChange={(e) => setOperatorPick(e.target.value)}
        >
          <option value="">No operator</option>
          {operators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.name}
            </option>
          ))}
        </Select>
      )}

      <Input
        id="fiber-name"
        label="Route name"
        placeholder={namePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Input
        id="fiber-cable-tag"
        label="Fiber ID"
        placeholder="Optional"
        value={cableTag}
        onChange={(e) => setCableTag(e.target.value)}
      />

      <Select
        id="fiber-type"
        label="Fiber type"
        value={cableType}
        onChange={(e) => setCableType(e.target.value)}
      >
        <option value="">Not recorded</option>
        {FIBER_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </Select>

      <div className="flex items-center justify-between gap-3 rounded-btn border border-line bg-card px-4 py-3">
        <span className="text-sm font-medium text-ink">IN / OUT</span>
        <div className="flex overflow-hidden rounded-full border border-line">
          {PLACEMENT_CHOICES.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={placement === value}
              onClick={() => setPlacement(value)}
              className={`min-h-11 px-4 text-sm font-medium transition-colors ${
                placement === value ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        id="fiber-notes"
        label="Remark"
        rows={2}
        placeholder="Optional"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Photos</p>
        <div className="flex flex-wrap items-center gap-2">
          {images.map((url) => (
            <span key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Fiber"
                className="h-14 w-14 rounded-btn border border-line object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
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
              onChange={handleImagesPicked}
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">Cores</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-1.5 text-sm font-medium text-ink">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: coreColor(coreCount) }}
            aria-hidden="true"
          />
          {coreCount} core
        </span>
      </div>

      {error && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" className="flex-1" disabled={saving} onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          className="flex-1"
          loading={saving}
          disabled={uploading || nameBlank || zoneMissing}
          onClick={handleSubmit}
        >
          {mode === 'edit' ? 'Save details' : 'Save fiber'}
        </Button>
      </div>
    </BottomSheet>
  )
}
