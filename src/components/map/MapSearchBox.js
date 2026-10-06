'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MIN_SEARCH_CHARS, matchBuildings, searchPinFrom } from '@/lib/map-search'
import { IconBuildings, IconClose, IconPin, IconSearch } from '@/components/ui/icons'
import { newSessionToken, resolvePlace, usePlaceSearch } from './usePlaceSearch'

const MAX_PLACES = 5

/**
 * The map tabs' one search box. Typing lists two groups in one dropdown:
 * Google places (anywhere, like Google Maps) and our own buildings. Picking a
 * place hands the parent a red-pin `{ latitude, longitude, label }`; picking a
 * building hands back the building. Neither hides anything on the map — the
 * layers keep following the Layers panel.
 *
 * `buildings` is what this user can already see, so the sales map never lists
 * a building outside its own scope. `pinned` says a red pin is on the map, so
 * ✕ stays offered to remove it even once the text is gone.
 */
export default function MapSearchBox({ buildings, getCenter, pinned = false, onPlace, onBuilding, onClear }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState(null)
  const [pickError, setPickError] = useState(false)
  const boxRef = useRef(null)

  const typed = query.trim()
  const tooShort = typed.length < MIN_SEARCH_CHARS
  const { results: places, status } = usePlaceSearch({
    query,
    token,
    enabled: open,
    getCenter,
    limit: MAX_PLACES,
  })
  const ours = useMemo(() => (open ? matchBuildings(buildings, typed) : []), [open, buildings, typed])

  // Close the list on a press anywhere outside the box.
  useEffect(() => {
    if (!open) return
    const onDown = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  function start() {
    // One Places session per search: a fresh token each time the list opens.
    if (!token) setToken(newSessionToken())
    setOpen(true)
  }

  function finish(text) {
    setQuery(text)
    setOpen(false)
    setToken(null)
    setPickError(false)
  }

  async function pickPlace(prediction) {
    let pin
    try {
      pin = searchPinFrom(prediction, await resolvePlace(prediction, token))
    } catch {
      pin = null
    }
    if (!pin) {
      setPickError(true)
      return
    }
    finish(pin.label)
    onPlace?.(pin)
  }

  function pickBuilding(building) {
    finish(building.buildingName)
    onBuilding?.(building)
  }

  function clear() {
    finish('')
    onClear?.()
  }

  const showList = open && !tooShort
  const nothing = status === 'done' && places.length === 0 && ours.length === 0

  return (
    <div ref={boxRef} className="relative flex-1 lg:max-w-md">
      <IconSearch
        className="pointer-events-none absolute left-4 top-6 h-4.5 w-4.5 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setPickError(false)
          start()
        }}
        onFocus={start}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Search a place or building…"
        aria-label="Search a place or building"
        className="min-h-12 w-full rounded-xl border border-line bg-card pl-11 pr-12 text-base shadow-md outline-none focus:ring-2 focus:ring-fiber/30"
      />
      {(query || pinned) && (
        <button
          type="button"
          onClick={clear}
          aria-label={pinned ? 'Clear search and remove the pin' : 'Clear search'}
          className="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-full text-faint transition-colors hover:text-ink"
        >
          <IconClose className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {showList && (
        <div className="mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-card shadow-lift">
          {(status === 'error' || pickError) && (
            <p className="px-4 py-3 text-sm font-normal text-bad">Place search is unavailable right now.</p>
          )}

          {(places.length > 0 || status === 'loading') && (
            <section>
              <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-faint">Places</p>
              {status === 'loading' && places.length === 0 && (
                <p className="px-4 pb-3 text-sm font-normal text-muted">Searching…</p>
              )}
              {places.map((prediction) => (
                <button
                  key={prediction.placeId}
                  type="button"
                  onClick={() => pickPlace(prediction)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper"
                >
                  <IconPin className="h-4 w-4 shrink-0 text-bad" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{prediction.primaryText}</span>
                    <span className="block truncate text-[11px] text-muted">{prediction.secondaryText}</span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {ours.length > 0 && (
            <section className={places.length > 0 ? 'border-t border-line' : ''}>
              <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-faint">
                Our buildings
              </p>
              {ours.map((building) => (
                <button
                  key={building.id}
                  type="button"
                  onClick={() => pickBuilding(building)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper"
                >
                  <IconBuildings className="h-4 w-4 shrink-0 text-fiber" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{building.buildingName}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {[building.formattedAddress, building.zone?.name].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {nothing && <p className="px-4 py-3 text-sm font-normal text-muted">No results</p>}
        </div>
      )}
    </div>
  )
}
