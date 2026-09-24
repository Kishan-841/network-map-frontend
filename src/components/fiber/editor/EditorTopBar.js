'use client'

import { IconArrowLeft, IconClose, IconPlus, IconUndo } from '@/components/ui/icons'

const ICON_BUTTON =
  'flex min-h-11 w-11 shrink-0 items-center justify-center rounded-btn text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent'

/**
 * One 48-px row: leave on the left, what you are editing in the middle, the
 * single thing worth tapping on the right. Everything that used to crowd this
 * row (Clear, the mode toggle, the layer switcher) lives in the drawer or the
 * bottom bar now.
 */
export default function EditorTopBar({
  phase,
  title,
  counts,
  canSave,
  dirty,
  savingPoints,
  showUndo,
  canUndo,
  onUndo,
  onLeave,
  onSave,
  onAddFiber,
}) {
  const drawing = phase === 'draw'
  const saveDisabled = drawing ? !canSave : !dirty || !canSave || savingPoints

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-line bg-card px-1.5 pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        onClick={onLeave}
        aria-label={drawing ? 'Cancel' : 'Done'}
        className={ICON_BUTTON}
      >
        {drawing ? (
          <IconClose className="h-5 w-5" aria-hidden="true" />
        ) : (
          <IconArrowLeft className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1 py-1 text-center">
        <p className="truncate text-sm font-bold leading-tight">{title}</p>
        <p className="truncate text-[11px] leading-tight text-muted">
          {counts.points} point{counts.points === 1 ? '' : 's'} · {counts.closures} closure
          {counts.closures === 1 ? '' : 's'} · {counts.splitters} splitter
          {counts.splitters === 1 ? '' : 's'}
        </p>
      </div>

      {showUndo && (
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo last point"
          className={ICON_BUTTON}
        >
          <IconUndo className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {onAddFiber && (
        <button
          type="button"
          onClick={onAddFiber}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-btn border border-line px-3 text-sm font-medium text-muted transition-colors hover:border-faint hover:text-ink"
        >
          <IconPlus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Add fiber</span>
        </button>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        className="flex min-h-11 shrink-0 items-center gap-2 rounded-btn bg-fiber px-3.5 text-sm font-medium text-on-fiber transition-colors hover:bg-fiber-deep disabled:opacity-35 disabled:hover:bg-fiber"
      >
        {savingPoints && <span className="loading loading-spinner loading-xs" />}
        {drawing ? 'Save fiber' : 'Save changes'}
      </button>
    </div>
  )
}
