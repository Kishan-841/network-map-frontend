'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { RATIO_LABELS } from '@/lib/fiber/constants'

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
 */
export default function SplitterForm({ closureId, endingFibers, onSaved, onCancel }) {
  const [ratio, setRatio] = useState('R1_2')
  const [fiberType, setFiberType] = useState('MAIN')
  const [location, setLocation] = useState('S1')
  const [inputFiberId, setInputFiberId] = useState(() =>
    endingFibers.length === 1 ? endingFibers[0].id : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await apiClient.post(`/closures/${closureId}/splitters`, {
        ratio,
        fiberType,
        location,
        inputFiberId: inputFiberId || null,
      })
      onSaved?.(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add this splitter'))
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
