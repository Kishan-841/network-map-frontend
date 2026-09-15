'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { POINT_COLORS } from '@/lib/fiber/constants'

const CARD_WIDTH = 248
const CARD_HEIGHT = 250 // enough room for the "Other" input to appear
const KINDS = ['Jumbo', 'Tiffin', 'Other']

/**
 * The small card that opens where a closure was just dropped on the line:
 * which kind it is, an optional note, Save or Cancel. Positioned at `at`
 * (container pixels) and clamped inside `bounds` like PointMenu.
 */
export default function ClosureCard({ at, bounds, saving, error, onSave, onCancel }) {
  const [kind, setKind] = useState('Jumbo')
  const [other, setOther] = useState('')
  const [notes, setNotes] = useState('')

  const resolvedKind = kind === 'Other' ? other.trim() : kind
  const canSave = !saving && (kind !== 'Other' || resolvedKind.length > 0)

  const left = bounds ? Math.max(8, Math.min(at.x, bounds.width - (CARD_WIDTH + 12))) : at.x
  const top = bounds?.height ? Math.max(8, Math.min(at.y, bounds.height - CARD_HEIGHT - 8)) : at.y

  return (
    <div
      style={{ left, top, width: CARD_WIDTH }}
      className="absolute z-30 flex flex-col gap-3 rounded-card border border-line bg-card p-3 shadow-lift"
    >
      <p className="flex items-center gap-2 text-sm font-bold">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: POINT_COLORS.CLOSURE }}
          aria-hidden="true"
        />
        New closure
      </p>

      <div className="flex gap-1.5">
        {KINDS.map((option) => (
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

      {kind === 'Other' && (
        <Input
          id="closure-kind-other"
          placeholder="Closure type"
          maxLength={50}
          autoFocus
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
      )}

      <Input
        id="closure-note"
        placeholder="Note (optional)"
        maxLength={500}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className="text-sm font-normal text-bad">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          loading={saving}
          disabled={!canSave}
          onClick={() => onSave({ kind: resolvedKind || null, notes: notes.trim() || null })}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
