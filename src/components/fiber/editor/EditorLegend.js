'use client'

const TOGGLES = [
  { key: 'buildings', label: 'Buildings' },
  { key: 'zones', label: 'Zones' },
  { key: 'others', label: 'Other fiber' },
]

/**
 * Overlay toggles for the fiber editor, bottom-left of the map. Every overlay
 * is lazy — nothing is fetched or drawn until its box is ticked.
 */
export default function EditorLegend({ value, onToggle, onClear, canClear }) {
  return (
    <div className="absolute bottom-[4.5rem] left-3 z-10 flex flex-col gap-2 sm:bottom-4 sm:flex-row">
      {TOGGLES.map((toggle) => (
        <label
          key={toggle.key}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-xs font-medium shadow-md"
        >
          <input
            type="checkbox"
            checked={value[toggle.key]}
            onChange={(e) => onToggle(toggle.key, e.target.checked)}
            className="checkbox checkbox-xs"
          />
          {toggle.label}
        </label>
      ))}
      {canClear && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-line bg-card px-3.5 py-2 text-xs font-medium text-bad shadow-md transition-colors hover:bg-bad-tint"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
