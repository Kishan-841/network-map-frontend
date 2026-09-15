'use client'

import { CORE_COUNTS, coreColor } from '@/lib/fiber/constants'

const DRAW_MODES = [
  { value: 'pan', label: 'Pan & zoom' },
  { value: 'draw', label: 'Draw points' },
]
const ANNOTATE_MODES = [
  { value: 'pan', label: 'Pan & zoom' },
  { value: 'addClosure', label: 'Add closure' },
  { value: 'editLine', label: 'Edit line' },
]

/**
 * The floating controls above the map: the mode segmented control (which
 * modes exist depends on the phase) and the core-count chips — the chosen
 * colour IS the line's colour, so they only show while the line is drawn.
 */
export default function EditorToolbar({ phase, mode, onMode, coreCount, onCoreCount, showCores }) {
  const modes = phase === 'draw' ? DRAW_MODES : ANNOTATE_MODES

  return (
    <>
      <div className="absolute left-3 top-[4.25rem] z-10 flex overflow-hidden rounded-btn border border-line bg-card/95 text-xs font-medium shadow-soft backdrop-blur sm:left-1/2 sm:top-3 sm:-translate-x-1/2 sm:text-sm">
        {modes.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onMode(option.value)}
            aria-pressed={mode === option.value}
            className={`min-h-11 px-3 transition-colors sm:px-4 ${
              mode === option.value ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {showCores && (
        <div className="absolute left-3 top-[7.25rem] z-10 flex max-w-[calc(100%-6rem)] flex-wrap gap-1.5 rounded-btn border border-line bg-card/95 p-1.5 shadow-soft backdrop-blur sm:left-1/2 sm:top-[3.9rem] sm:-translate-x-1/2">
          {CORE_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onCoreCount(count)}
              aria-pressed={coreCount === count}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
                coreCount === count ? 'bg-paper ring-1 ring-line' : 'text-muted hover:text-ink'
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full border border-white shadow"
                style={{ backgroundColor: coreColor(count) }}
              />
              {count} core
            </button>
          ))}
        </div>
      )}
    </>
  )
}
