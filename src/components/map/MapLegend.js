'use client'

import { useState } from 'react'
import { LIVE_COLOR, NOT_LIVE_COLOR } from '@/lib/constants'
import { IconLayers, IconClose } from '@/components/ui/icons'

/**
 * Map key + declutter control. The Buildings row toggles all pins on/off; a
 * colour key underneath explains green = live connection, red = not live.
 * Floating card on desktop, sheet on mobile.
 */
export function MapLegend({
  buildingCount,
  liveCount,
  notLiveCount,
  buildingsShown,
  onToggleBuildings,
  zonesShown,
  zoneCount,
  onToggleZones,
}) {
  const [open, setOpen] = useState(false)

  const keyDot = (color) => (
    <span
      className="h-3 w-3 shrink-0 rounded-full border-2 border-white shadow-sm"
      style={{ backgroundColor: color }}
    />
  )

  const rows = (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={onToggleBuildings}
        aria-pressed={buildingsShown}
        className={`flex items-center gap-2.5 rounded-btn px-2 py-1.5 text-left transition-colors hover:bg-paper ${
          buildingsShown ? '' : 'opacity-40'
        }`}
      >
        <IconLayers className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} />
        <span className="flex-1 truncate text-sm font-medium">Buildings</span>
        <span className="shrink-0 text-xs font-normal tabular-nums text-faint">
          {buildingCount}
        </span>
      </button>

      {/* Colour key */}
      <div className="ml-2 mb-1 flex flex-col gap-1 border-l border-line/60 pl-3">
        <span className="flex items-center gap-2 text-xs font-normal text-muted">
          {keyDot(LIVE_COLOR)} Live
          <span className="ml-auto tabular-nums text-faint">{liveCount}</span>
        </span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted">
          {keyDot(NOT_LIVE_COLOR)} Not live
          <span className="ml-auto tabular-nums text-faint">{notLiveCount}</span>
        </span>
      </div>

      {zoneCount > 0 && (
        <button
          onClick={onToggleZones}
          aria-pressed={zonesShown}
          className={`flex items-center gap-2.5 rounded-btn px-2 py-1.5 text-left transition-colors hover:bg-paper ${
            zonesShown ? '' : 'opacity-40'
          }`}
        >
          <span className="h-3 w-3 shrink-0 rounded-[3px] border-2 border-dashed border-fiber bg-fiber/15" />
          <span className="flex-1 truncate text-sm font-medium">Coverage zones</span>
          <span className="shrink-0 text-xs font-normal tabular-nums text-faint">{zoneCount}</span>
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile: a compact button that opens a bottom sheet */}
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute bottom-4 left-3 z-40 flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-medium shadow-md lg:hidden"
      >
        <IconLayers className="h-4.5 w-4.5" strokeWidth={1.8} />
        Layers
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-ink/40 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl bg-card p-5 pb-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Map layers</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 text-faint">
                <IconClose className="h-5 w-5" />
              </button>
            </div>
            {rows}
          </div>
        </div>
      )}

      {/* Desktop: an always-visible floating card */}
      <div className="pointer-events-auto absolute bottom-6 left-6 z-40 hidden w-52 rounded-card border border-line bg-card/95 p-4 shadow-lift backdrop-blur lg:block">
        <p className="mb-2.5 flex items-center gap-2 text-sm font-bold">
          <IconLayers className="h-4 w-4 text-fiber" strokeWidth={1.8} />
          Legend
        </p>
        {rows}
      </div>
    </>
  )
}
