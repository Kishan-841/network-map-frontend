'use client'

import { Button } from '@/components/ui/Button'

/**
 * Title row of the fiber editor: what is being drawn, how much of it there is,
 * and the four actions. Single row on desktop, title + button row on mobile.
 */
export default function EditorHeader({ title, counts, canSave, onUndo, onClear, onCancel, onSave }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-card px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-faint">Fiber</p>
        <p className="truncate font-bold">{title}</p>
      </div>
      <p className="shrink-0 text-sm tabular-nums text-muted">
        {counts.points} point{counts.points === 1 ? '' : 's'} · {counts.typed} typed ·{' '}
        {counts.closures} closure{counts.closures === 1 ? '' : 's'}
      </p>
      <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto">
        <Button variant="secondary" onClick={onUndo} disabled={counts.points === 0}>
          Undo
        </Button>
        <Button variant="secondary" onClick={onClear} disabled={counts.points === 0}>
          Clear
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={!canSave}>
          Save…
        </Button>
      </div>
    </div>
  )
}
