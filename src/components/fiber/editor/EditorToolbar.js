'use client'

import { CORE_COUNTS, coreColor } from '@/lib/fiber/constants'

/**
 * The floating controls above the map: Pan/Draw mode, the core-count chips
 * (the chosen colour IS the line's colour) and the splitter-feed chip.
 */
export default function EditorToolbar({
  drawing,
  onDrawing,
  coreCount,
  onCoreCount,
  fromSplitterOutput,
  canClearFeed,
  onClearFeed,
}) {
  return (
    <>
      <div className="absolute left-3 top-[4.25rem] z-10 flex overflow-hidden rounded-btn border border-line bg-card/95 text-xs font-medium shadow-soft backdrop-blur sm:left-1/2 sm:top-3 sm:-translate-x-1/2 sm:text-sm">
        <button
          type="button"
          onClick={() => onDrawing(false)}
          aria-pressed={!drawing}
          className={`px-3 py-2.5 transition-colors sm:px-4 ${
            drawing ? 'text-muted hover:text-ink' : 'bg-fiber text-white'
          }`}
        >
          Pan &amp; zoom
        </button>
        <button
          type="button"
          onClick={() => onDrawing(true)}
          aria-pressed={drawing}
          className={`px-3 py-2.5 transition-colors sm:px-4 ${
            drawing ? 'bg-fiber text-white' : 'text-muted hover:text-ink'
          }`}
        >
          Draw points
        </button>
      </div>

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

      {fromSplitterOutput && (
        <div className="absolute left-3 top-[10.25rem] z-10 flex w-fit items-center gap-2 rounded-full border border-line bg-card/95 px-3 py-1.5 text-xs font-medium text-fiber shadow-soft backdrop-blur sm:left-1/2 sm:top-[6.6rem] sm:-translate-x-1/2">
          Fed by {fromSplitterOutput.closureCode} · out {fromSplitterOutput.portNo}
          {canClearFeed && (
            <button
              type="button"
              aria-label="Clear splitter feed"
              onClick={onClearFeed}
              className="text-faint transition-colors hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </>
  )
}
