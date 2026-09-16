'use client'

import { useState } from 'react'
import { CORE_COUNTS, coreColor } from '@/lib/fiber/constants'
import {
  IconChevronLeft,
  IconChevronRight,
  IconHelp,
  IconOptions,
} from '@/components/ui/icons'

const OPEN_KEY = 'fiber-drawer-open'
const MAP_TYPES = [
  { key: 'roadmap', label: 'Map' },
  { key: 'satellite', label: 'Satellite' },
  { key: 'hybrid', label: 'Hybrid' },
]
const LAYERS = [
  { key: 'buildings', label: 'Buildings' },
  { key: 'zones', label: 'Zones' },
  { key: 'others', label: 'Other fiber' },
]

const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}
const writeOpen = (value) => {
  try {
    localStorage.setItem(OPEN_KEY, value ? '1' : '0')
  } catch {
    // Private mode — the drawer still works for this session.
  }
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3 first:border-t-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{title}</p>
      {children}
    </div>
  )
}

/**
 * Everything the map needs occasionally, off the map until it is asked for:
 * core count, base layer, context overlays, and the draft's destructive action.
 * The slim tab on the right edge is the only thing it costs the map, and its
 * open/closed state is remembered between sessions.
 */
export default function EditorDrawer({
  coreCount,
  onCoreCount,
  layer,
  onLayer,
  overlays,
  onToggleOverlay,
  onClear,
  canClear,
  onDetails,
  onHelp,
}) {
  const [open, setOpenState] = useState(readOpen)

  const setOpen = (value) => {
    writeOpen(value)
    setOpenState(value)
  }

  return (
    <>
      {/* The tab, and the hint re-play button stacked above it. */}
      <div className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end gap-2">
        <button
          type="button"
          onClick={onHelp}
          aria-label="Show the hint for this mode"
          className="mr-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted shadow-lift transition-colors hover:text-ink"
        >
          <IconHelp className="h-4 w-4" aria-hidden="true" />
        </button>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open map options"
            className="flex h-16 w-7 items-center justify-center rounded-l-btn bg-card text-muted shadow-lift transition-colors hover:text-ink"
          >
            <IconChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-card pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lift">
            <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
              <IconOptions className="h-4 w-4 text-fiber" aria-hidden="true" />
              <p className="flex-1 text-sm font-bold">Options</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close map options"
                className="flex h-11 w-11 items-center justify-center rounded-btn text-muted transition-colors hover:text-ink"
              >
                <IconChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <Section title="Core count">
              {CORE_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onCoreCount(count)}
                  aria-pressed={coreCount === count}
                  className={`flex min-h-11 items-center gap-2.5 rounded-btn px-3 text-sm font-medium transition-colors ${
                    coreCount === count ? 'bg-fiber-tint text-ink ring-1 ring-fiber' : 'text-muted hover:text-ink'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow"
                    style={{ backgroundColor: coreColor(count) }}
                    aria-hidden="true"
                  />
                  {count} core
                </button>
              ))}
            </Section>

            <Section title="Map">
              <div className="flex overflow-hidden rounded-btn border border-line text-sm font-medium">
                {MAP_TYPES.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onLayer(option.key)}
                    aria-pressed={layer === option.key}
                    className={`min-h-11 flex-1 px-2 transition-colors ${
                      layer === option.key ? 'bg-fiber text-on-fiber' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Layers">
              {LAYERS.map((toggle) => (
                <label
                  key={toggle.key}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors hover:bg-paper"
                >
                  <input
                    type="checkbox"
                    checked={overlays[toggle.key]}
                    onChange={(e) => onToggleOverlay(toggle.key, e.target.checked)}
                    className="checkbox checkbox-sm"
                  />
                  {toggle.label}
                </label>
              ))}
            </Section>

            {onDetails && (
              <Section title="Fiber">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onDetails()
                  }}
                  className="flex min-h-11 items-center rounded-btn px-3 text-sm font-medium text-muted transition-colors hover:bg-paper hover:text-ink"
                >
                  Edit details…
                </button>
              </Section>
            )}

            {canClear && (
              <Section title="Draft">
                <button
                  type="button"
                  onClick={onClear}
                  className="flex min-h-11 items-center rounded-btn px-3 text-sm font-medium text-bad transition-colors hover:bg-bad-tint"
                >
                  Clear all points
                </button>
              </Section>
            )}
          </div>
        </>
      )}
    </>
  )
}
