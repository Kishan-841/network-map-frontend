'use client'

import { useEffect, useState } from 'react'
import { LIVE_COLOR, NOT_LIVE_COLOR } from '@/lib/constants'
import { POINT_COLORS } from '@/lib/fiber/constants'
import { hiddenLayerCount } from '@/lib/map-layers'
import { IconLayers, IconClose, IconTriangle } from '@/components/ui/icons'

/**
 * Map key + declutter control. The Buildings row toggles all pins on/off; the
 * Live / Not live rows underneath filter within that (green = live, red =
 * not live). Folded into a Layers button on every screen so the map keeps its
 * space: the button opens a bottom sheet on mobile and a panel above itself on
 * desktop. A dot on the button says a layer has been switched off.
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
  liveShown,
  onToggleLive,
  notLiveShown,
  onToggleNotLive,
  fiberShown,
  fiberCount,
  onToggleFiber,
  popsShown,
  popCount,
  onTogglePops,
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const hiddenCount = hiddenLayerCount({
    buildings: buildingsShown,
    live: liveShown,
    notLive: notLiveShown,
    zones: zoneCount > 0 ? zonesShown : undefined,
    pops: popCount > 0 ? popsShown : undefined,
  })

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

      {/* Colour key — each row is also a filter within the Buildings layer */}
      <div className="ml-2 mb-1 flex flex-col gap-0.5 border-l border-line/60 pl-2">
        <button
          onClick={onToggleLive}
          aria-pressed={liveShown}
          className={`flex w-full items-center gap-2 rounded-btn px-1.5 py-1 text-left text-xs font-normal text-muted transition-colors hover:bg-paper ${
            liveShown ? '' : 'opacity-40'
          }`}
        >
          {keyDot(LIVE_COLOR)} Live
          <span className="ml-auto tabular-nums text-faint">{liveCount}</span>
        </button>
        <button
          onClick={onToggleNotLive}
          aria-pressed={notLiveShown}
          className={`flex w-full items-center gap-2 rounded-btn px-1.5 py-1 text-left text-xs font-normal text-muted transition-colors hover:bg-paper ${
            notLiveShown ? '' : 'opacity-40'
          }`}
        >
          {keyDot(NOT_LIVE_COLOR)} Not live
          <span className="ml-auto tabular-nums text-faint">{notLiveCount}</span>
        </button>
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

      {popCount > 0 && (
        <button
          onClick={onTogglePops}
          aria-pressed={popsShown}
          className={`flex items-center gap-2.5 rounded-btn px-2 py-1.5 text-left transition-colors hover:bg-paper ${
            popsShown ? '' : 'opacity-40'
          }`}
        >
          {/* Same shape and colour as the pin on the map. */}
          <IconTriangle
            className="h-4 w-4 shrink-0"
            fill={POINT_COLORS.POP}
            stroke={POINT_COLORS.POP}
            strokeWidth={1.5}
            strokeLinejoin="round"
            aria-hidden="true"
          />
          <span className="flex-1 truncate text-sm font-medium">POPs</span>
          <span className="shrink-0 text-xs font-normal tabular-nums text-faint">{popCount}</span>
        </button>
      )}

      <button
        onClick={onToggleFiber}
        aria-pressed={fiberShown}
        className={`flex items-center gap-2.5 rounded-btn px-2 py-1.5 text-left transition-colors hover:bg-paper ${
          fiberShown ? '' : 'opacity-40'
        }`}
      >
        {/* The line, then the three typed points it can pass through: POP
            (square), closure (circle), splitter (diamond). */}
        <span className="flex shrink-0 items-center gap-1">
          <span className="h-0.5 w-4 rounded-full bg-[#f59e0b]" />
          <span
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: POINT_COLORS.POP }}
          />
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: POINT_COLORS.CLOSURE }}
          />
          <span
            className="h-2 w-2 rotate-45"
            style={{ backgroundColor: POINT_COLORS.SPLITTER }}
          />
        </span>
        <span className="flex-1 truncate text-sm font-medium">Fiber</span>
        <span className="shrink-0 text-xs font-normal tabular-nums text-faint">
          {fiberShown ? fiberCount : ''}
        </span>
      </button>
    </div>
  )

  return (
    <>
      {/* One button on every screen — the legend stays folded until wanted. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={hiddenCount > 0 ? `Layers, ${hiddenCount} hidden` : 'Layers'}
        className="pointer-events-auto absolute bottom-4 left-3 z-40 flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-medium shadow-md transition-colors hover:border-fiber/50 lg:bottom-6 lg:left-6"
      >
        <IconLayers className="h-4.5 w-4.5" strokeWidth={1.8} />
        Layers
        {hiddenCount > 0 && (
          <span className="h-2 w-2 rounded-full bg-fiber" aria-hidden="true" />
        )}
      </button>

      {/* Mobile: bottom sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-ink/40 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl bg-card p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-xl"
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

      {/* Desktop: a panel above the button. The catcher behind it closes the
          panel on a click anywhere else, without dimming the map. */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 hidden lg:block" onClick={() => setOpen(false)} />
          <div className="pointer-events-auto absolute bottom-20 left-6 z-50 hidden w-56 rounded-card border border-line bg-card/95 p-4 shadow-lift backdrop-blur lg:block">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold">
                <IconLayers className="h-4 w-4 text-fiber" strokeWidth={1.8} />
                Legend
              </p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close legend"
                className="-m-1 p-1 text-faint transition-colors hover:text-ink"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            {rows}
          </div>
        </>
      )}
    </>
  )
}
