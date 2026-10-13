'use client'

import { useEffect, useState } from 'react'
import { LIVE_COLOR, NOT_LIVE_COLOR } from '@/lib/constants'
import { POINT_COLORS } from '@/lib/fiber/constants'
import { hiddenLayerCount } from '@/lib/map-layers'
import { IconLayers, IconClose, IconTriangle, IconShield, IconBuildings } from '@/components/ui/icons'

/**
 * Map key + declutter control. The Buildings row toggles all pins on/off; the
 * Live / Not live / Society permission rows underneath filter within that
 * (green = live, red = not live; societies are a shield and their own row). Folded into a Layers button on every screen so the map keeps its
 * space: the button opens a bottom sheet on mobile and a panel above itself on
 * desktop. A dot on the button says a layer has been switched off.
 */
export function MapLegend({
  buildingCount,
  liveCount,
  notLiveCount,
  societyCount = 0,
  societyShown = true,
  onToggleSociety,
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
  closuresShown = true,
  onToggleClosures,
  splittersShown = true,
  onToggleSplitters,
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
    society: societyCount > 0 ? societyShown : undefined,
    zones: zoneCount > 0 ? zonesShown : undefined,
    pops: popCount > 0 ? popsShown : undefined,
    fiber: fiberShown,
    closures: closuresShown,
    splitters: splittersShown,
  })

  /**
   * A layer tile, like Google Maps' "Map details": the layer's own symbol on a
   * square, the name and count under it. On = coloured border + tinted label.
   */
  const tile = ({ symbol, label, count, on, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={Boolean(on)}
      className="group flex min-w-0 flex-col items-center gap-1.5 rounded-btn text-center focus-visible:outline-none"
    >
      <span
        className={`flex aspect-square w-full items-center justify-center rounded-xl border-2 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-focus ${
          on ? 'border-fiber bg-fiber/10' : 'border-line bg-paper group-hover:border-faint'
        }`}
        aria-hidden="true"
      >
        {symbol}
      </span>
      <span className={`w-full truncate text-xs leading-tight ${on ? 'font-semibold text-fiber' : 'font-medium text-ink'}`}>
        {label}
      </span>
      {count != null && <span className="-mt-1 text-[11px] leading-none tabular-nums text-muted">{count}</span>}
    </button>
  )

  /**
   * A filter chip inside the Buildings layer: a filled dot (or shield) when
   * shown, hollow when not — on/off without fading anything.
   */
  const chip = ({ color, shield = false, symbol, label, count, on, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={Boolean(on)}
      className={`flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        on ? 'border-fiber/40 bg-fiber/10 text-ink' : 'border-line bg-card text-muted hover:border-faint'
      }`}
    >
      {symbol ? (
        symbol(on)
      ) : shield ? (
        <IconShield
          className={`h-3.5 w-3.5 shrink-0 ${on ? 'text-ink' : 'text-faint'}`}
          fill={on ? 'currentColor' : 'none'}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ) : (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
          style={{ borderColor: color, backgroundColor: on ? color : 'transparent' }}
          aria-hidden="true"
        />
      )}
      {label}
      {count != null && <span className="tabular-nums text-muted">{count}</span>}
    </button>
  )
  const tiles = [
    tile({
      symbol: <IconBuildings className="h-7 w-7 text-ok" strokeWidth={1.7} />,
      label: 'Buildings',
      count: buildingCount,
      on: buildingsShown,
      onToggle: onToggleBuildings,
    }),
    zoneCount > 0 &&
      tile({
        symbol: <span className="h-6 w-6 rounded-md border-2 border-dashed border-fiber bg-fiber/15" />,
        label: 'Zones',
        count: zoneCount,
        on: zonesShown,
        onToggle: onToggleZones,
      }),
    popCount > 0 &&
      tile({
        // Same shape and colour as the pin on the map.
        symbol: (
          <IconTriangle
            className="h-7 w-7"
            fill={POINT_COLORS.POP}
            stroke={POINT_COLORS.POP}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ),
        label: 'POPs',
        count: popCount,
        on: popsShown,
        onToggle: onTogglePops,
      }),
    tile({
      // A cable with a closure on it.
      symbol: (
        <span className="relative flex h-6 w-9 items-center">
          <span className="h-1 w-full rounded-full bg-[#f59e0b]" />
          <span
            className="absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white"
            style={{ backgroundColor: POINT_COLORS.CLOSURE }}
          />
        </span>
      ),
      label: 'Fiber',
      count: fiberShown ? fiberCount : null,
      on: fiberShown,
      onToggle: onToggleFiber,
    }),
  ].filter(Boolean)

  const rows = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">{tiles}</div>

      {/* Filters within the Buildings layer — only while it is on. */}
      {buildingsShown && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Show buildings that are</p>
          <div className="flex flex-wrap gap-2">
            {chip({ color: LIVE_COLOR, label: 'Live', count: liveCount, on: liveShown, onToggle: onToggleLive })}
            {chip({
              color: NOT_LIVE_COLOR,
              label: 'Not live',
              count: notLiveCount,
              on: notLiveShown,
              onToggle: onToggleNotLive,
            })}
            {/* Approved societies: their own filter, drawn as a shield. */}
            {societyCount > 0 &&
              chip({
                shield: true,
                label: 'Society permission',
                count: societyCount,
                on: societyShown,
                onToggle: onToggleSociety,
              })}
          </div>
        </div>
      )}

      {/* Filters within the Fiber layer — only while cables are drawn. */}
      {fiberShown && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Show on fiber lines</p>
          <div className="flex flex-wrap gap-2">
            {chip({
              symbol: (on) => (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
                  style={{ borderColor: POINT_COLORS.CLOSURE, backgroundColor: on ? POINT_COLORS.CLOSURE : 'transparent' }}
                  aria-hidden="true"
                />
              ),
              label: 'Closures',
              on: closuresShown,
              onToggle: onToggleClosures,
            })}
            {chip({
              symbol: (on) => (
                <span
                  className="h-2 w-2 shrink-0 rotate-45 border-2"
                  style={{ borderColor: POINT_COLORS.SPLITTER, backgroundColor: on ? POINT_COLORS.SPLITTER : 'transparent' }}
                  aria-hidden="true"
                />
              ),
              label: 'Splitters',
              on: splittersShown,
              onToggle: onToggleSplitters,
            })}
          </div>
        </div>
      )}
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
          <div className="pointer-events-auto absolute bottom-20 left-6 z-50 hidden w-80 rounded-card border border-line bg-card/95 p-4 shadow-lift backdrop-blur lg:block">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-sm font-bold">Map layers</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close map layers"
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
