'use client'

/**
 * Row of summary tiles shared by the Customers tab and a building's customers page.
 * `tiles` are { id, label, count, active }; `count` null shows "…". Tapping calls `onPick(tile)`.
 */
export function SummaryTiles({ tiles, onPick, className = '' }) {
  return (
    <div className={`mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 ${className}`} role="group" aria-label="Summary">
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          aria-pressed={tile.active}
          onClick={() => onPick(tile)}
          className={`rounded-card border p-4 text-left transition-colors duration-200 ${
            tile.active ? 'border-fiber bg-fiber-tint' : 'border-line bg-card hover:border-fiber/50'
          }`}
        >
          <span className="block text-xs font-medium text-muted">{tile.label}</span>
          <span className="mt-1 block text-2xl font-bold tabular-nums tracking-tight">
            {tile.count == null ? '…' : tile.count.toLocaleString('en-IN')}
          </span>
        </button>
      ))}
    </div>
  )
}
