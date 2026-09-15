'use client'

/**
 * The one-line hint under the map, plus the touch-friendly "Snap" pill that
 * does what Escape does on a keyboard: skip snapping for the next tap.
 */
export default function EditorHintBar({ drawing, snapOff, onToggleSnapOff }) {
  const hint = snapOff
    ? 'Snap off for next click'
    : drawing
      ? 'Tap to add a point · right-click (long-press) a point to type it · Esc skips snapping once'
      : 'Navigate to the area, then switch to Draw points · drag handles to adjust'

  return (
    <div className="pointer-events-none absolute bottom-4 left-3 right-16 z-10 flex items-center justify-center gap-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
      <p className="rounded-2xl border border-line bg-card/90 px-4 py-1.5 text-center text-xs text-muted shadow sm:rounded-full">
        {hint}
      </p>
      {drawing && (
        <button
          type="button"
          aria-pressed={snapOff}
          onClick={onToggleSnapOff}
          className={`pointer-events-auto shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium shadow transition-colors ${
            snapOff ? 'bg-fiber text-white' : 'bg-card/90 text-muted hover:text-ink'
          }`}
        >
          Snap
        </button>
      )}
    </div>
  )
}
