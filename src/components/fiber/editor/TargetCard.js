'use client'

const KIND_LABEL = { POP: 'POP', CLOSURE: 'Closure', BUILDING: 'Building' }

/**
 * Compact details for a POP / closure / building tapped in Pan mode — the
 * editor's equivalent of the main map's building card.
 */
export default function TargetCard({ target, onClose }) {
  const kind = KIND_LABEL[target.kind] ?? target.kind
  return (
    <div className="absolute bottom-16 left-3 right-3 z-10 mx-auto max-w-sm rounded-card border border-line bg-card p-4 shadow-lift sm:bottom-14">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{target.label}</p>
          <p className="truncate text-sm font-normal text-muted">
            {target.splitter ? `${kind} · splitter ${target.splitter}` : kind}
          </p>
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
      {target.kind === 'BUILDING' && (
        <a
          href={`/buildings/${target.id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-right text-xs font-medium text-fiber hover:underline"
        >
          Open building ↗
        </a>
      )}
    </div>
  )
}
