'use client'

/**
 * Compact, read-only details for a saved closure tapped on the draft line in
 * annotate + Pan mode — its code, type, note and lat/long. Same idiom as
 * TargetCard: a bottom-anchored card, not pixel-positioned at the tap.
 */
export default function ClosureInfoCard({ point, onClose }) {
  const ref = point.ref ?? {}
  return (
    <div className="absolute bottom-16 left-3 right-3 z-10 mx-auto max-w-sm rounded-card border border-line bg-card p-4 shadow-lift sm:bottom-14">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{ref.code ?? 'Closure'}</p>
          <p className="truncate text-sm font-normal text-muted">{ref.kind || 'Closure'}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="shrink-0 p-1 text-faint transition-colors hover:text-ink"
        >
          ✕
        </button>
      </div>
      {ref.notes && <p className="mt-2 text-sm font-normal text-muted">{ref.notes}</p>}
      <p className="mt-2 font-mono text-xs text-faint">
        {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
      </p>
    </div>
  )
}
