'use client'

import { useEffect, useRef, useState } from 'react'
import { getMapProvider } from '@/lib/map-providers'
import { IconSearch } from '@/components/ui/icons'

/**
 * Location search for the fiber editor — the same debounced provider stack as
 * the add-building flow. `getCenter()` biases predictions to what the map is
 * showing; `onJump({ latitude, longitude })` pans the caller's map.
 */
export default function EditorSearch({ getCenter, onJump }) {
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState([])
  // Mirrors so a caller passing fresh arrows never re-runs the debounce.
  const getCenterRef = useRef(getCenter)
  const onJumpRef = useRef(onJump)
  useEffect(() => {
    getCenterRef.current = getCenter
    onJumpRef.current = onJump
  })

  useEffect(() => {
    const input = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        if (input.length < 3) {
          setPredictions([])
          return
        }
        const center = getCenterRef.current?.() ?? {}
        getMapProvider()
          .autocomplete({
            input,
            latitude: center.latitude,
            longitude: center.longitude,
            signal: controller.signal,
          })
          .then((results) => setPredictions(results.slice(0, 5)))
          .catch(() => {})
      },
      input.length < 3 ? 0 : 350,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  async function jumpTo(prediction) {
    setQuery('')
    setPredictions([])
    let { latitude, longitude } = prediction
    if (latitude == null) {
      try {
        ;({ latitude, longitude } = await getMapProvider().getPlaceDetails({
          placeId: prediction.placeId,
        }))
      } catch {
        return
      }
    }
    onJumpRef.current?.({ latitude, longitude })
  }

  return (
    <div className="absolute left-3 right-3 top-3 z-10 sm:right-auto sm:w-72 sm:max-w-[calc(100%-6rem)]">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search location…"
          className="h-11 w-full rounded-xl border border-line bg-card pl-9 pr-3 text-sm shadow-md outline-none focus:border-fiber focus:ring-2 focus:ring-fiber/15"
        />
      </div>
      {predictions.length > 0 && (
        <div className="mt-1 overflow-hidden rounded-xl border border-line bg-card shadow-lift">
          {predictions.map((prediction) => (
            <button
              key={prediction.placeId}
              type="button"
              onClick={() => jumpTo(prediction)}
              className="block w-full truncate px-3 py-2.5 text-left text-sm transition-colors hover:bg-paper"
            >
              <span className="font-medium">{prediction.name}</span>
              <span className="block truncate text-xs text-muted">
                {prediction.formattedAddress}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
