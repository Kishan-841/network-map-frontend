'use client'

import { useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { uploadFile } from '@/lib/upload'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useFibers, invalidateFibers } from '@/hooks/useFibers'
import { usePops, invalidatePops } from '@/hooks/usePops'
import { invalidateClosures } from '@/hooks/useClosures'
import { useOperators } from '@/hooks/useOperators'
import { deriveSegments, toPayloadPoints } from '@/lib/fiber/draft'
import { coreColor, FIBER_STATUS } from '@/lib/fiber/constants'
import SegmentTable from './SegmentTable'

const STATUS_CHOICES = ['PLANNED', 'LIVE']
const PLACEMENT_CHOICES = [
  { value: 'IN', label: 'IN' },
  { value: 'OUT', label: 'OUT' },
  { value: null, label: '—' },
]

/**
 * Details + segment table for saving a fiber (Save… overlay in the fiber
 * editor). Replaces the old GoogleFiberEditor save card: same overlay idiom
 * (dark backdrop, rounded card) but built for the new typed-point fiber
 * model — cascading POP → OLT → PON port, a status that can't override a
 * cut fiber, and a per-segment laid-metres table derived from the draft.
 */
export default function SavePanel({
  mode,
  fiber,
  draftPoints,
  coreCount,
  fromSplitterOutput,
  onSaved,
  onBack,
}) {
  const { fibers } = useFibers()
  const { pops } = usePops()
  const { operators } = useOperators()

  const [name, setName] = useState(() => fiber?.name ?? '')
  const [cableType, setCableType] = useState(() => fiber?.cableType ?? '')
  const [popId, setPopId] = useState(() => fiber?.olt?.pop?.id ?? '')
  const [oltId, setOltId] = useState(() => fiber?.oltId ?? '')
  const [ponPort, setPonPort] = useState(() => (fiber?.ponPort != null ? String(fiber.ponPort) : ''))
  const [status, setStatus] = useState(() => (fiber?.status === 'CUT' ? 'CUT' : (fiber?.status ?? 'PLANNED')))
  const [cableTag, setCableTag] = useState(() => fiber?.cableTag ?? '')
  const [placement, setPlacement] = useState(() => fiber?.placement ?? null)
  const [operatorId, setOperatorId] = useState(() => fiber?.operatorId ?? '')
  const [notes, setNotes] = useState(() => fiber?.notes ?? '')
  const [images, setImages] = useState(() => fiber?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const derived = useMemo(() => deriveSegments(draftPoints), [draftPoints])
  const segmentsMatch = mode === 'edit' && fiber && fiber.segments.length === derived.length
  const [laid, setLaid] = useState(() =>
    derived.map((segment, i) =>
      segmentsMatch ? (fiber.segments[i].fiberLaidMeters ?? Math.round(segment.mapMeters)) : Math.round(segment.mapMeters)
    )
  )
  const segmentWarning =
    mode === 'edit' && fiber && fiber.segments.length !== derived.length && derived.length > 0
      ? 'Typed points changed — laid metres will be re-entered'
      : null

  const namePlaceholder = `Auto — FIB-${String(fibers.length + 1).padStart(3, '0')}`
  const cutLocked = mode === 'edit' && fiber?.status === 'CUT'

  const oltOptions = pops.find((p) => p.id === popId)?.olts ?? []
  const selectedOlt = oltOptions.find((o) => o.id === oltId)

  // Ports another fiber already occupies on this OLT (never this fiber's own port).
  const usedPorts = useMemo(() => {
    const map = new Map()
    if (!oltId) return map
    for (const f of fibers) {
      if (f.oltId === oltId && f.ponPort != null && f.id !== fiber?.id) map.set(f.ponPort, f.name)
    }
    return map
  }, [fibers, oltId, fiber?.id])

  function handlePopChange(e) {
    setPopId(e.target.value)
    setOltId('')
    setPonPort('')
  }

  function handleOltChange(e) {
    setOltId(e.target.value)
    setPonPort('') // port list depends on the OLT — stale selection would be invalid
  }

  function onChangeLaid(index, value) {
    setLaid((prev) => prev.map((v, i) => (i === index ? value : v)))
  }

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
        cableType: cableType.trim() || null,
        cableTag: cableTag.trim() || null,
        operatorId: operatorId || null,
        notes: notes.trim() || null,
        images,
        placement,
        points: toPayloadPoints(draftPoints),
        segmentLaidMeters: laid,
      }
      const trimmedName = name.trim()
      if (trimmedName) payload.name = trimmedName
      if (fromSplitterOutput) {
        payload.fromSplitterOutput = {
          splitterId: fromSplitterOutput.splitterId,
          portNo: fromSplitterOutput.portNo,
        }
      } else {
        payload.oltId = oltId || null
        payload.ponPort = oltId && ponPort !== '' ? Number(ponPort) : null
      }
      if (!cutLocked) payload.status = status

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

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-full w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-card bg-card p-5 shadow-lift">
        <h2 className="text-base font-bold">{mode === 'edit' ? 'Save fiber' : 'New fiber'}</h2>

        <Input
          id="fiber-name"
          placeholder={namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        <Input
          id="fiber-cable-type"
          placeholder="Cable type (optional)"
          value={cableType}
          onChange={(e) => setCableType(e.target.value)}
        />

        {fromSplitterOutput ? (
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-fiber-tint px-3.5 py-1.5 text-sm font-medium text-fiber">
            Fed by {fromSplitterOutput.closureCode} · out {fromSplitterOutput.portNo}
          </span>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select id="fiber-pop" value={popId} onChange={handlePopChange}>
              <option value="">No POP</option>
              {pops.map((pop) => (
                <option key={pop.id} value={pop.id}>
                  {pop.name}
                </option>
              ))}
            </Select>
            <Select id="fiber-olt" value={oltId} onChange={handleOltChange}>
              <option value="">No OLT</option>
              {oltOptions.map((olt) => (
                <option key={olt.id} value={olt.id}>
                  {olt.name}
                </option>
              ))}
            </Select>
            <Select id="fiber-pon-port" value={ponPort} onChange={(e) => setPonPort(e.target.value)}>
              <option value="">—</option>
              {selectedOlt &&
                Array.from({ length: selectedOlt.ponPortCount }, (_, i) => i + 1).map((port) => {
                  const usedBy = usedPorts.get(port)
                  return (
                    <option key={port} value={port} disabled={Boolean(usedBy)}>
                      {usedBy ? `${port} · ${usedBy}` : port}
                    </option>
                  )
                })}
            </Select>
          </div>
        )}

        {cutLocked ? (
          <span
            className={`w-fit rounded-full px-3.5 py-1.5 text-sm font-medium ${FIBER_STATUS.CUT.className}`}
          >
            {FIBER_STATUS.CUT.label}
          </span>
        ) : (
          <div className="flex w-fit overflow-hidden rounded-btn border border-line text-sm font-medium">
            {STATUS_CHOICES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={status === option}
                onClick={() => setStatus(option)}
                className={`px-4 py-2 transition-colors ${
                  status === option ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {FIBER_STATUS[option].label}
              </button>
            ))}
          </div>
        )}

        <Input
          id="fiber-cable-tag"
          placeholder="Cable tag (optional)"
          value={cableTag}
          onChange={(e) => setCableTag(e.target.value)}
        />

        <div className="flex items-center justify-between gap-3 rounded-btn border border-line bg-card px-4 py-3">
          <span className="text-sm font-medium text-ink">Placement</span>
          <div className="flex overflow-hidden rounded-full border border-line">
            {PLACEMENT_CHOICES.map(({ value, label }) => (
              <button
                key={label}
                type="button"
                aria-pressed={placement === value}
                onClick={() => setPlacement(value)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  placement === value ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Select id="fiber-operator" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
          <option value="">No operator</option>
          {operators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.name}
            </option>
          ))}
        </Select>

        <Textarea
          id="fiber-notes"
          rows={2}
          placeholder="Notes (optional)"
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

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Segments</p>
          <SegmentTable rows={derived} laid={laid} onChangeLaid={onChangeLaid} warning={segmentWarning} />
        </div>

        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" disabled={saving} onClick={onBack}>
            Back
          </Button>
          <Button
            className="flex-1"
            loading={saving}
            disabled={uploading || nameBlank}
            onClick={handleSubmit}
          >
            {mode === 'edit' ? 'Save fiber' : 'Create fiber'}
          </Button>
        </div>
      </div>
    </div>
  )
}
