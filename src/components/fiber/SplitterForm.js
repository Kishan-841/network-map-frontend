'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { RATIO_LABELS } from '@/lib/fiber/constants'
import { PLACEMENTS, MAX_FLOOR, splitterPlaceBody, splitterPlaceError } from '@/lib/fiber/splitter-place'
import FiberPicker from '@/components/fiber/FiberPicker'

const RATIOS = Object.keys(RATIO_LABELS)
const LOCATIONS = ['S1', 'S2', 'S3']
const FIBER_TYPES = ['MAIN', 'SUB']
const FIBER_TYPE_LABEL = { MAIN: 'Main', SUB: 'Sub' }

/** Segmented pill group — same idiom as SavePanel's status/placement pickers. */
function PillGroup({ options, value, onChange, label: labelFor }) {
  return (
    <div className="flex w-fit overflow-hidden rounded-btn border border-line text-sm font-medium">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`min-h-11 px-4 transition-colors ${
            value === option ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {labelFor ? labelFor(option) : option}
        </button>
      ))}
    </div>
  )
}

/**
 * Inline "add a splitter" form shown under a closure's splitter list. One
 * shot at picking ratio + fiber type + location + which ending fiber feeds
 * it — the outputs themselves are wired up later, output by output.
 * Pass `splitter` to EDIT that splitter instead (PATCH /splitters/:id); then
 * `endingFibers` are the fibers that may feed it.
 *
 * In a building (spec 2026-11-24-splitter-in-building): pass `building`
 * ({ id, wings }) and `pin` to ADD one there (POST /splitters), or edit a
 * splitter that has a building with its `wings`. The form then also asks for
 * the wing, where in the building and a note, and the input fiber is picked
 * from fibres near the pin or by route name.
 */
export default function SplitterForm({ closureId, splitter, endingFibers = [], building, pin, wings, onSaved, onCancel }) {
  const inBuilding = Boolean(building || splitter?.building)
  const wingList = building?.wings ?? wings ?? []
  const fiberPin = pin ?? (splitter ? { latitude: splitter.latitude, longitude: splitter.longitude } : null)
  const [place, setPlace] = useState({
    wingId: splitter?.wing?.id ?? '',
    placement: splitter?.placement ?? '',
    floorNumber: splitter?.floorNumber != null ? String(splitter.floorNumber) : '',
    note: splitter?.note ?? '',
  })
  const [inputFiber, setInputFiber] = useState(splitter?.inputFiber ? { id: splitter.inputFiber.id, name: splitter.inputFiber.name } : null)
  const [ratio, setRatio] = useState(splitter?.ratio ?? 'R1_2')
  const [fiberType, setFiberType] = useState(splitter ? (splitter.fiberType ?? '') : 'MAIN')
  const [location, setLocation] = useState(splitter?.location ?? 'S1')
  const [inputFiberId, setInputFiberId] = useState(() => {
    if (splitter) return splitter.inputFiberId ?? splitter.inputFiber?.id ?? ''
    return endingFibers.length === 1 ? endingFibers[0].id : ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const base = { ratio, fiberType: fiberType || null, location }
      let res
      if (inBuilding) {
        const placeError = splitterPlaceError(place)
        if (placeError) {
          setError(placeError)
          setSaving(false)
          return
        }
        const body = { ...base, inputFiberId: inputFiber?.id ?? null, ...splitterPlaceBody(place) }
        res = splitter
          ? await apiClient.patch(`/splitters/${splitter.id}`, body)
          : await apiClient.post('/splitters', { ...body, buildingId: building.id, latitude: pin.latitude, longitude: pin.longitude })
      } else {
        const body = { ...base, inputFiberId: inputFiberId || null }
        res = splitter
          ? await apiClient.patch(`/splitters/${splitter.id}`, body)
          : await apiClient.post(`/closures/${closureId}/splitters`, body)
      }
      onSaved?.(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, splitter ? 'Could not save this splitter' : 'Could not add this splitter'))
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line p-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Ratio</span>
        <PillGroup options={RATIOS} value={ratio} onChange={setRatio} label={(r) => RATIO_LABELS[r]} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Fiber type</span>
        <PillGroup
          options={FIBER_TYPES}
          value={fiberType}
          onChange={setFiberType}
          label={(t) => FIBER_TYPE_LABEL[t]}
        />
      </div>

      <Select
        id="splitter"
        label="Splitter type"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      >
        {LOCATIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>

      {inBuilding ? (
        <FiberPicker latitude={fiberPin?.latitude} longitude={fiberPin?.longitude} value={inputFiber} onChange={setInputFiber} />
      ) : (
        <Select
          id="splitter-input-fiber"
          label="Input fiber"
          value={inputFiberId}
          onChange={(e) => setInputFiberId(e.target.value)}
        >
          <option value="">— none yet —</option>
          {endingFibers.map((fiber) => (
            <option key={fiber.id} value={fiber.id}>
              {fiber.name}
            </option>
          ))}
        </Select>
      )}

      {inBuilding && wingList.length > 0 && (
        <Select
          id="splitter-wing"
          label="Wing"
          value={place.wingId}
          onChange={(e) => setPlace({ ...place, wingId: e.target.value })}
        >
          <option value="">No particular wing</option>
          {wingList.map((w) => (
            <option key={w.id} value={w.id}>
              Wing {w.name}
            </option>
          ))}
        </Select>
      )}

      {inBuilding && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Where in the building</span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4" role="group" aria-label="Where in the building">
              {PLACEMENTS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={place.placement === p.value}
                  onClick={() => setPlace({ ...place, placement: place.placement === p.value ? '' : p.value })}
                  className={`min-h-11 rounded-btn border px-4 text-sm font-medium transition-colors ${
                    place.placement === p.value ? 'border-fiber bg-fiber text-white' : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {place.placement === 'FLOOR' && (
              <div className="w-28">
                <Input
                  id="splitter-floor"
                  aria-label="Floor number"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_FLOOR}
                  step={1}
                  placeholder="Floor no."
                  value={place.floorNumber}
                  onChange={(e) => setPlace({ ...place, floorNumber: e.target.value })}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {inBuilding && (
        <Textarea
          id="splitter-note"
          label="Note"
          rows={2}
          maxLength={500}
          placeholder="e.g. inside the meter room, left wall"
          value={place.note}
          onChange={(e) => setPlace({ ...place, note: e.target.value })}
        />
      )}

      {error && <p className="rounded-btn bg-bad-tint p-3 text-sm font-medium text-bad">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          className="h-11 min-h-11 flex-1"
          loading={saving}
          onClick={handleSave}
        >
          Save
        </Button>
        <Button type="button" variant="ghost" className="h-11 min-h-11" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
