'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { IconClose, IconTrash } from '@/components/ui/icons'
import { RATIO_LABELS } from '@/lib/fiber/constants'
import BottomSheet, { SHEET_DIALOG } from './BottomSheet'

const RATIOS = Object.keys(RATIO_LABELS)
const FIBER_TYPES = [
  { value: 'MAIN', label: 'Main' },
  { value: 'SUB', label: 'Sub' },
]
const LOCATIONS = ['S1', 'S2', 'S3']

/** Segmented pill group — same idiom as SplitterForm's ratio/location pickers. */
function PillGroup({ label, options, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex overflow-hidden rounded-btn border border-line text-sm font-medium">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-11 flex-1 px-3 transition-colors ${
              value === option.value ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * One splitter on the line being edited, in two modes that share the same
 * three controls:
 *
 *  - create — a splitter just dropped on the line. Save sends it with the
 *    fiber PATCH the caller has queued; Cancel takes the point back off.
 *  - edit   — a saved splitter (`initial`). Save PATCHes it directly.
 *
 * `code` is the splitter's own S-code once it has one.
 */
export default function SplitterModal({ code, initial, onSave, onRemove, onCancel, saving, error }) {
  const [ratio, setRatio] = useState(() => initial?.ratio ?? 'R1_2')
  const [fiberType, setFiberType] = useState(() => initial?.fiberType ?? 'MAIN')
  const [location, setLocation] = useState(() => initial?.location ?? 'S1')

  const editing = Boolean(initial)

  const handleRemove = () => {
    const label = RATIO_LABELS[initial?.ratio] ?? initial?.ratio ?? 'splitter'
    if (!window.confirm(`Remove the ${label} splitter${code ? ` ${code}` : ''}?`)) return
    onRemove?.()
  }

  return (
    <BottomSheet desktop={SHEET_DIALOG} backdrop onBackdropClick={onCancel} className="gap-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="text-base font-bold">
          {editing && code ? `Edit splitter · ${code}` : `${editing ? 'Edit' : 'Add'} splitter`}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-faint transition-colors hover:text-ink"
        >
          <IconClose className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <PillGroup
        label="Ratio"
        options={RATIOS.map((value) => ({ value, label: RATIO_LABELS[value] }))}
        value={ratio}
        onChange={setRatio}
      />
      <PillGroup label="Fiber type" options={FIBER_TYPES} value={fiberType} onChange={setFiberType} />
      <Select
        id="splitter-location"
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

      {error && <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>}

      <div className="flex flex-col gap-2 border-t border-line/60 pt-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 flex-1"
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11 flex-1"
            loading={saving}
            onClick={() => onSave({ ratio, fiberType, location })}
          >
            Save
          </Button>
        </div>
        {editing && onRemove && (
          <Button type="button" variant="danger" className="min-h-11" disabled={saving} onClick={handleRemove}>
            <IconTrash className="h-4 w-4" aria-hidden="true" />
            Remove splitter
          </Button>
        )}
      </div>
    </BottomSheet>
  )
}
