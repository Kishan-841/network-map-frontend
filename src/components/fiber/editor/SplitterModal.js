'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { IconTrash } from '@/components/ui/icons'
import { RATIO_LABELS } from '@/lib/fiber/constants'

const RATIOS = Object.keys(RATIO_LABELS)
const FIBER_TYPES = [
  { value: 'MAIN', label: 'Main' },
  { value: 'SUB', label: 'Sub' },
]
const LOCATIONS = ['LAN', 'WAN']

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
 * The splitter on ONE closure of the line being edited, in two modes that
 * share the same three pickers:
 *
 *  - create — "Add splitter" mode, a closure with no splitter yet. Save POSTs
 *    it with the open fiber as its input.
 *  - edit   — the closure already carries one (`initial`). Save PATCHes it;
 *    Remove deletes it after a confirm.
 */
export default function SplitterModal({ closure, initial, onSave, onRemove, onCancel, saving, error }) {
  const [ratio, setRatio] = useState(() => initial?.ratio ?? 'R1_2')
  const [fiberType, setFiberType] = useState(() => initial?.fiberType ?? 'MAIN')
  const [location, setLocation] = useState(() => initial?.location ?? 'WAN')

  const editing = Boolean(initial)

  const handleRemove = () => {
    const label = RATIO_LABELS[initial?.ratio] ?? initial?.ratio ?? 'splitter'
    if (!window.confirm(`Remove the ${label} splitter on ${closure?.code ?? 'this closure'}?`)) return
    onRemove?.()
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={`${editing ? 'Edit' : 'Add'} splitter · ${closure?.code ?? 'Closure'}`}
      footer={
        <div className="flex flex-col gap-2">
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
      }
    >
      <div className="flex flex-col gap-4">
        <PillGroup
          label="Ratio"
          options={RATIOS.map((value) => ({ value, label: RATIO_LABELS[value] }))}
          value={ratio}
          onChange={setRatio}
        />
        <PillGroup label="Fiber type" options={FIBER_TYPES} value={fiberType} onChange={setFiberType} />
        <PillGroup
          label="Location"
          options={LOCATIONS.map((value) => ({ value, label: value }))}
          value={location}
          onChange={setLocation}
        />

        {error && <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
