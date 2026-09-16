'use client'

import { Button } from '@/components/ui/Button'

/**
 * Title row of the fiber editor. Which actions it offers depends on the
 * phase: a new line is drawn then saved; a saved fiber is annotated with
 * closures, its line edited, then closed with Done.
 */
export default function EditorHeader({
  title,
  counts,
  phase,
  canSave,
  hint,
  dirty,
  savingPoints,
  drawingLine,
  onUndo,
  onClear,
  onCancel,
  onSave,
  onDetails,
  onSaveChanges,
  onDone,
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-card px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-faint">Fiber</p>
        <p className="truncate font-bold">{title}</p>
        {hint && <p className="truncate text-xs font-normal text-muted">{hint}</p>}
      </div>
      <p className="shrink-0 text-sm tabular-nums text-muted">
        {counts.points} point{counts.points === 1 ? '' : 's'} · {counts.closures} closure
        {counts.closures === 1 ? '' : 's'} · {counts.splitters ?? 0} splitter
        {counts.splitters === 1 ? '' : 's'}
      </p>

      {phase === 'draw' ? (
        <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto">
          <Button type="button" variant="secondary" onClick={onUndo} disabled={counts.points === 0}>
            Undo
          </Button>
          <Button type="button" variant="secondary" onClick={onClear} disabled={counts.points === 0}>
            Clear
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={!canSave}>
            Save fiber
          </Button>
        </div>
      ) : (
        <div className={`grid w-full gap-2 sm:flex sm:w-auto ${drawingLine ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {drawingLine && (
            <Button type="button" variant="secondary" onClick={onUndo} disabled={counts.points === 0}>
              Undo
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onDetails}>
            Details
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={savingPoints}
            disabled={!dirty || !canSave}
            onClick={onSaveChanges}
          >
            Save changes
          </Button>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </div>
      )}
    </div>
  )
}
