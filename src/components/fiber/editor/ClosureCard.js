'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { IconTrash } from '@/components/ui/icons'
import { POINT_COLORS } from '@/lib/fiber/constants'

const CARD_WIDTH = 248
const CARD_HEIGHT = 250 // enough room for the "Other" input to appear
const KINDS = ['Jumbo', 'Tiffin', 'Other']

// A saved kind is either one of the pills verbatim, or free text that only
// ever came from "Other" — there is no third source.
const initialKindState = (kind) => (kind && !KINDS.includes(kind) ? { kind: 'Other', other: kind } : { kind: kind || 'Jumbo', other: '' })

/**
 * The card for a closure on the draft line, in two modes that share the same
 * kind pills / note input:
 *
 *  - `create` — a closure just dropped on the line. Pixel-positioned at `at`
 *    (clamped inside `bounds`, like PointMenu). Save mints it via the fiber
 *    PATCH the caller already has queued.
 *  - `edit`   — a saved closure tapped in annotate + Pan mode. Bottom-anchored,
 *    same idiom as TargetCard. Save PATCHes the closure directly; Remove takes
 *    it off the line (the point stays as a plain bend) via `onRemove`.
 */
export default function ClosureCard({ mode = 'create', initial, at, bounds, saving, error, onSave, onRemove, onCancel }) {
  const [{ kind, other }, setKindState] = useState(() => initialKindState(initial?.kind))
  const [notes, setNotes] = useState(() => initial?.notes ?? '')

  const resolvedKind = kind === 'Other' ? other.trim() : kind
  const canSave = !saving && (kind !== 'Other' || resolvedKind.length > 0)

  const pixelPositioned = mode === 'create'
  const left = pixelPositioned && bounds ? Math.max(8, Math.min(at.x, bounds.width - (CARD_WIDTH + 12))) : at?.x
  const top = pixelPositioned && bounds?.height ? Math.max(8, Math.min(at.y, bounds.height - CARD_HEIGHT - 8)) : at?.y

  return (
    <div
      style={pixelPositioned ? { left, top, width: CARD_WIDTH } : undefined}
      className={
        pixelPositioned
          ? 'absolute z-30 flex flex-col gap-3 rounded-card border border-line bg-card p-3 shadow-lift'
          : 'absolute bottom-16 left-3 right-3 z-30 mx-auto flex max-w-sm flex-col gap-3 rounded-card border border-line bg-card p-4 shadow-lift sm:bottom-14'
      }
    >
      <p className="flex items-center gap-2 text-sm font-bold">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: POINT_COLORS.CLOSURE }}
          aria-hidden="true"
        />
        {mode === 'edit' ? (initial?.code ?? 'Closure') : 'New closure'}
      </p>

      <div className="flex gap-1.5">
        {KINDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            onClick={() => setKindState({ kind: option, other: option === 'Other' ? other : '' })}
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

      {kind === 'Other' && (
        <Input
          id="closure-kind-other"
          placeholder="Closure type"
          maxLength={50}
          autoFocus
          value={other}
          onChange={(e) => setKindState({ kind: 'Other', other: e.target.value })}
        />
      )}

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
          disabled={!canSave}
          onClick={() => onSave({ kind: resolvedKind || null, notes: notes.trim() || null })}
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
    </div>
  )
}
