'use client'

import { useEffect, useRef, useState } from 'react'
import { GOOGLE_MAPS_API_KEY } from '@/lib/map-config'
import { getMapProvider } from '@/lib/map-providers'
import { googlePlacesProvider } from '@/lib/map-providers/google-places-provider'
import { MIN_SEARCH_CHARS } from '@/lib/map-search'

const DEBOUNCE_MS = 350

// Google Places (New) whenever the key is configured — a technician searching
// an Indian address needs Google's index, whatever NEXT_PUBLIC_MAP_PROVIDER
// says the *display* stack is. Nominatim stays the keyless fallback.
const searchProvider = () => (GOOGLE_MAPS_API_KEY ? googlePlacesProvider : getMapProvider())

export const newSessionToken = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`

/**
 * Place suggestions for what was typed, debounced, the previous request
 * aborted on every keystroke. `token` is the Places session token: one per
 * search session, reused by `resolvePlace`, so Google bills one session rather
 * than one request per keystroke. Pass `enabled: false` while the field is
 * closed.
 */
export function usePlaceSearch({ query, token, enabled = true, getCenter, limit = 6 }) {
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | done | error

  // A caller passing a fresh arrow each render must not re-run the debounce.
  const getCenterRef = useRef(getCenter)
  useEffect(() => {
    getCenterRef.current = getCenter
  })

  useEffect(() => {
    const input = String(query ?? '').trim()
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        if (!enabled || input.length < MIN_SEARCH_CHARS) {
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
            setResults(predictions.slice(0, limit))
            setStatus('done')
          })
          .catch((err) => {
            if (err?.name === 'AbortError') return
            setResults([])
            setStatus('error')
          })
      },
      enabled && input.length >= MIN_SEARCH_CHARS ? DEBOUNCE_MS : 0,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, token, enabled, limit])

  return { results, status }
}

/** A prediction's coordinates — some providers carry them, Google needs a details call. */
export async function resolvePlace(prediction, token) {
  if (prediction.latitude != null) return { latitude: prediction.latitude, longitude: prediction.longitude }
  const { latitude, longitude } = await searchProvider().getPlaceDetails({
    placeId: prediction.placeId,
    sessionToken: token,
  })
  return { latitude, longitude }
}
