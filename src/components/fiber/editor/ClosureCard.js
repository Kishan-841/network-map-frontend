'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { IconTrash } from '@/components/ui/icons'
import { CLOSURE_KINDS, FIBER_TYPE_LABELS, POINT_COLORS, RATIO_LABELS } from '@/lib/fiber/constants'
import BottomSheet, { SHEET_ANCHORED } from './BottomSheet'

const CARD_WIDTH = 248
const CARD_HEIGHT = 230
// `create` still lands on the pixel that was tapped — but only from `lg` up,
// where there is room beside the line. On a phone it is a bottom sheet.
const SHEET_AT_PIXEL =
  'lg:absolute lg:bottom-auto lg:right-auto lg:left-[var(--card-x)] lg:top-[var(--card-y)] lg:w-[248px] lg:max-h-none lg:rounded-card lg:p-3 lg:pb-3'

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
  const [kind, setKind] = useState(() => initial?.kind || CLOSURE_KINDS[0])
  const [notes, setNotes] = useState(() => initial?.notes ?? '')

  // A closure saved before these three were the only choices keeps its own
  // wording, shown as a chip it cannot be put back to once it is changed.
  const legacyKind = CLOSURE_KINDS.includes(kind) ? null : kind

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
            key={option}
            type="button"
            aria-pressed={kind === option}
            onClick={() => setKind(option)}
            className={`min-h-11 flex-1 rounded-btn border px-2 text-sm font-medium transition-colors ${
              kind === option
                ? 'border-fiber bg-fiber text-white'
                : 'border-line bg-card text-muted hover:text-ink'
            }`}
          >
            {option}
          </button>
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
          onClick={() => onSave({ kind: kind || null, notes: notes.trim() || null })}
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
