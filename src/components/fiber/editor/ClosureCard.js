'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { IconTrash } from '@/components/ui/icons'
import {
  CLOSURE_KINDS,
  CORE_COUNTS,
  FIBER_TYPE_LABELS,
  FIBER_TYPES,
  POINT_COLORS,
  RATIO_LABELS,
  TUBE_COUNTS,
} from '@/lib/fiber/constants'
import BottomSheet, { SHEET_ANCHORED } from './BottomSheet'

const CARD_WIDTH = 320
const CARD_HEIGHT = 500
// `create` still lands on the pixel that was tapped — but only from `lg` up,
// where there is room beside the line. On a phone it is a bottom sheet.
const SHEET_AT_PIXEL =
  'lg:absolute lg:bottom-auto lg:right-auto lg:left-[var(--card-x)] lg:top-[var(--card-y)] lg:w-[320px] lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:rounded-card lg:p-3 lg:pb-3'

/**
 * The card for a closure on the draft line, in two modes that share the same
 * kind pills / note input:
 *
 *  - `create` — a closure just dropped on the line. Pixel-positioned at `at`
 *    (clamped inside `bounds`, like PointMenu) on a desktop; a bottom sheet on
 *    a phone. Save mints it via the fiber PATCH the caller already has queued.
 *  - `edit`   — a saved closure tapped in annotate + Pan mode. Bottom-anchored,
 *    same idiom as TargetCard. Save PATCHes the closure directly; Remove takes
 *    it off the line (the point stays as a plain bend) via `onRemove`.
 */
export default function ClosureCard({ mode = 'create', initial, splitter, at, bounds, saving, error, onSave, onRemove, onRemoveSplitter, onCancel }) {
  const [kind, setKind] = useState(() => initial?.kind || CLOSURE_KINDS[0].value)
  const [notes, setNotes] = useState(() => initial?.notes ?? '')
  // The survey sheet: which cable this sits on, its tubes, and the cores in
  // and out. All optional — a closure dropped while drawing is often recorded
  // before anyone has opened it.
  const [sheet, setSheet] = useState(() => ({
    fiberType: initial?.fiberType ?? '',
    tubeCount: initial?.tubeCount ?? '',
    inCoreCount: initial?.inCoreCount ?? '',
    outCoreCount: initial?.outCoreCount ?? '',
  }))
  const setField = (key) => (e) => setSheet((s) => ({ ...s, [key]: e.target.value }))
  const numberOrNull = (v) => (v === '' || v === null ? null : Number(v))

  // A closure saved before these three were the only choices keeps its own
  // wording, shown as a chip it cannot be put back to once it is changed.
  const legacyKind = CLOSURE_KINDS.some((option) => option.value === kind) ? null : kind

  const pixelPositioned = mode === 'create'
  const left = pixelPositioned && bounds ? Math.max(8, Math.min(at.x, bounds.width - (CARD_WIDTH + 12))) : at?.x
  const top = pixelPositioned && bounds?.height ? Math.max(8, Math.min(at.y, bounds.height - CARD_HEIGHT - 8)) : at?.y

  return (
    <BottomSheet
      desktop={pixelPositioned ? SHEET_AT_PIXEL : SHEET_ANCHORED}
      className="gap-3"
      style={pixelPositioned ? { '--card-x': `${left}px`, '--card-y': `${top}px` } : undefined}
    >
      <p className="flex items-center gap-2 text-sm font-bold">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: POINT_COLORS.CLOSURE }}
          aria-hidden="true"
        />
        {mode === 'edit' ? (initial?.code ?? 'Closure') : 'New closure'}
      </p>

      {/* Splitters live on the line in their own right now. A closure that
          still carries one from before says so, and the only thing left to do
          with it here is take it off. */}
      {mode === 'edit' && splitter && (
        <div className="flex flex-col gap-2 rounded-btn bg-paper px-3 py-2">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <span
              className="h-2.5 w-2.5 shrink-0 rotate-45"
              style={{ backgroundColor: POINT_COLORS.SPLITTER }}
              aria-hidden="true"
            />
            Splitter {RATIO_LABELS[splitter.ratio] ?? splitter.ratio}
            {splitter.fiberType ? ` · ${FIBER_TYPE_LABELS[splitter.fiberType] ?? splitter.fiberType}` : ''}
            {splitter.location ? ` · ${splitter.location}` : ''}
          </p>
          <Button
            type="button"
            variant="danger"
            className="min-h-11"
            disabled={saving}
            onClick={onRemoveSplitter}
          >
            <IconTrash className="h-4 w-4" aria-hidden="true" />
            Remove splitter
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {legacyKind && (
          <span
            aria-current="true"
            className="min-h-11 w-full rounded-btn border border-line bg-paper px-2 py-2.5 text-center text-sm font-medium text-muted"
          >
            {legacyKind}
          </span>
        )}
        {CLOSURE_KINDS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            onClick={() => setKind(option.value)}
            className={`min-h-11 flex-1 rounded-btn border px-2 text-sm font-medium transition-colors ${
              kind === option.value
                ? 'border-fiber bg-fiber text-white'
                : 'border-line bg-card text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted">Cable type</span>
        <Select id="closure-fiber-type" value={sheet.fiberType} onChange={setField('fiberType')}>
          <option value="">Not recorded</option>
          {FIBER_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
      </label>

      {/* Labelled above rather than crammed into the option text: three
          side-by-side dropdowns truncate to "0 ·", "In", "Ou" otherwise. */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'closure-tubes', key: 'tubeCount', label: 'Tubes', values: TUBE_COUNTS },
          { id: 'closure-in-core', key: 'inCoreCount', label: 'Core in', values: CORE_COUNTS },
          { id: 'closure-out-core', key: 'outCoreCount', label: 'Core out', values: CORE_COUNTS },
        ].map((field) => (
          <label key={field.id} className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">{field.label}</span>
            <Select id={field.id} value={sheet[field.key]} onChange={setField(field.key)}>
              <option value="">—</option>
              {field.values.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </Select>
          </label>
        ))}
      </div>

      <Input
        id="closure-note"
        placeholder="Note (optional)"
        maxLength={500}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1 min-h-11" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1 min-h-11"
          loading={saving}
          disabled={saving}
          onClick={() =>
            onSave({
              kind: kind || null,
              notes: notes.trim() || null,
              fiberType: sheet.fiberType || null,
              tubeCount: numberOrNull(sheet.tubeCount),
              inCoreCount: numberOrNull(sheet.inCoreCount),
              outCoreCount: numberOrNull(sheet.outCoreCount),
            })
          }
        >
          Save
        </Button>
      </div>

      {mode === 'edit' && (
        <Button
          type="button"
          variant="danger"
          className="min-h-11"
          disabled={saving}
          onClick={onRemove}
        >
          <IconTrash className="h-4 w-4" aria-hidden="true" />
          Remove closure
        </Button>
      )}
    </BottomSheet>
  )
}
