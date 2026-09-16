'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GOOGLE_MAPS_API_KEY } from '@/lib/map-config'
import { getMapProvider } from '@/lib/map-providers'
import { googlePlacesProvider } from '@/lib/map-providers/google-places-provider'
import { IconClose, IconSearch } from '@/components/ui/icons'

const MIN_CHARS = 3
const DEBOUNCE_MS = 350
const MAX_RESULTS = 6

// Google Places (New) whenever the key is configured — a technician searching
// an Indian address needs Google's index, whatever NEXT_PUBLIC_MAP_PROVIDER
// says the *display* stack is. Nominatim stays the keyless fallback.
const searchProvider = () => (GOOGLE_MAPS_API_KEY ? googlePlacesProvider : getMapProvider())

const newToken = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`

/**
 * Location search, folded away until it is wanted: a round button under the
 * top bar that expands into a full-width field.
 *
 * One `sessionToken` covers every keystroke of one open-search session plus
 * the final details lookup, which is what keeps Places billing to one session
 * instead of one request per keystroke.
 */
export default function EditorSearchButton({ getCenter, onJump }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [token, setToken] = useState(null)

  // Mirrors so a caller passing fresh arrows never re-runs the debounce.
  const getCenterRef = useRef(getCenter)
  const onJumpRef = useRef(onJump)
  useEffect(() => {
    getCenterRef.current = getCenter
    onJumpRef.current = onJump
  })

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setStatus('idle')
    setToken(null)
  }, [])

  useEffect(() => {
    if (!open) return
    const input = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        if (input.length < MIN_CHARS) {
          setResults([])
          setStatus('idle')
          return
        }
        setStatus('loading')
        const center = getCenterRef.current?.() ?? {}
        searchProvider()
          .autocomplete({
            input,
            latitude: center.latitude,
            longitude: center.longitude,
            sessionToken: token,
            signal: controller.signal,
          })
          .then((predictions) => {
            setResults(predictions.slice(0, MAX_RESULTS))
            setStatus('done')
          })
          .catch((err) => {
            if (err?.name === 'AbortError') return
            setResults([])
            setStatus('error')
          })
      },
      input.length < MIN_CHARS ? 0 : DEBOUNCE_MS,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open, token])

  async function pick(prediction) {
    let { latitude, longitude } = prediction
    if (latitude == null) {
      try {
        ;({ latitude, longitude } = await searchProvider().getPlaceDetails({
          placeId: prediction.placeId,
          sessionToken: token,
        }))
      } catch {
        setStatus('error')
        return
      }
    }
    close()
    onJumpRef.current?.({ latitude, longitude })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setToken(newToken())
          setOpen(true)
        }}
        aria-label="Search for a location"
        className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted shadow-lift transition-colors hover:text-ink"
      >
        <IconSearch className="h-5 w-5" aria-hidden="true" />
      </button>
    )
  }

  const tooShort = query.trim().length < MIN_CHARS

  return (
    <div className="absolute inset-x-3 top-3 z-30">
      <div className="relative">
        <IconSearch
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
          }}
          placeholder="Search location…"
          aria-label="Search location"
          className="h-12 w-full rounded-btn border border-line bg-card pl-9 pr-12 text-sm shadow-lift outline-none focus:border-fiber focus:ring-2 focus:ring-fiber/15"
        />
        <button
          type="button"
          onClick={close}
          aria-label="Close search"
          className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-faint transition-colors hover:text-ink"
        >
          <IconClose className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {!tooShort && (
        <div className="mt-1 max-h-72 overflow-y-auto rounded-btn border border-line bg-card shadow-lift">
          {status === 'error' && (
            <p className="px-3 py-3 text-sm font-normal text-bad">
              Search is unavailable right now.
            </p>
          )}
          {status === 'loading' && results.length === 0 && (
            <p className="px-3 py-3 text-sm font-normal text-muted">Searching…</p>
          )}
          {status === 'done' && results.length === 0 && (
            <p className="px-3 py-3 text-sm font-normal text-muted">No results</p>
          )}
          {results.map((prediction) => (
            <button
              key={prediction.placeId}
              type="button"
              onClick={() => pick(prediction)}
              className="block min-h-12 w-full px-3 py-2.5 text-left transition-colors hover:bg-paper"
            >
              <span className="block truncate text-sm font-medium">{prediction.primaryText}</span>
              <span className="block truncate text-[11px] text-muted">
                {prediction.secondaryText}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
