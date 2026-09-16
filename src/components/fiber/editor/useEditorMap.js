'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { DECLUTTER_MAP_STYLE } from '@/lib/map-markers'

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // country-level fallback
const DEFAULT_ZOOM = 5
const GPS_TIMEOUT_MS = 6000
const GPS_OPTIONS = { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 60000 }
export const GPS_ZOOM = 17
export const PLACE_ZOOM = 15

// Google's zoom buttons sit at the map's bottom-right, which is where the mode
// bar now lives — lift them clear of it (and of the phone's home bar).
export const MAP_CHROME_CSS = `
.fiber-zone-label { text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.75); }
.fiber-editor-map .gm-bundled-control { margin-bottom: calc(4.75rem + env(safe-area-inset-bottom)) !important; }
@media (min-width: 1024px) { .fiber-editor-map .gm-bundled-control { margin-bottom: 1.5rem !important; } }
`

/** Where the last fiber anyone saved starts — the fallback when GPS says no. */
function lastFiberStart(fibers) {
  const drawn = fibers.filter((f) => f.points?.length > 0)
  if (drawn.length === 0) return null
  const newest = drawn.reduce((best, f) =>
    Date.parse(f.createdAt ?? 0) > Date.parse(best.createdAt ?? 0) ? f : best,
  )
  return { lat: newest.points[0].latitude, lng: newest.points[0].longitude }
}

/**
 * The editor's Google Map: boot, base layer, gesture freeze, live size, and
 * where it opens.
 *
 * A NEW line opens on the technician: the device position is asked for once
 * (6 s), and the map is never held back for it — it is already live on the
 * default view while the browser's prompt is up. Denied or unavailable, it
 * falls back to where the last saved fiber starts.
 */
export function useEditorMap({ layer, frozen, existing, fibers, draftRef, onReady }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  // The map instance lives in state as well as a ref: hooks take it as a prop
  // (a ref may not be read during render), the ref serves the DOM listeners.
  const [map, setMap] = useState(null)
  const [containerSize, setContainerSize] = useState(null)
  const [locating, setLocating] = useState(false)
  // Seeded from the device, never set from an effect body: a browser with no
  // geolocation at all has already "failed" before the first render.
  const [gpsFailed, setGpsFailed] = useState(
    () => typeof navigator !== 'undefined' && !('geolocation' in navigator),
  )
  const ready = map !== null

  // An existing fiber already frames itself from its own points.
  const centredRef = useRef(Boolean(existing))
  const layerRef = useRef(layer)
  const readyRef = useRef(onReady)
  useEffect(() => {
    readyRef.current = onReady
  })

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || mapRef.current || !containerRef.current) return
      const map = new Map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: layerRef.current,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        styles: DECLUTTER_MAP_STYLE,
      })
      mapRef.current = map
      const points = draftRef.current.points
      if (points.length > 0) {
        const bounds = new google.maps.LatLngBounds()
        points.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }))
        map.fitBounds(bounds, 64)
      }
      setMap(map)
      readyRef.current?.()
    })
    return () => {
      cancelled = true
      mapRef.current = null
    }
  }, [draftRef])

  useEffect(() => {
    layerRef.current = layer
    if (mapRef.current && ready) mapRef.current.setMapTypeId(layer)
  }, [layer, ready])

  // Draw / Add closure: freeze pan-drag gestures (zoom buttons still work).
  useEffect(() => {
    if (!mapRef.current || !ready) return
    mapRef.current.setOptions({
      gestureHandling: frozen ? 'none' : 'greedy',
      draggableCursor: frozen ? 'crosshair' : null,
    })
  }, [frozen, ready])

  // The create-closure card clamps itself inside the map — it needs the live size.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize((prev) =>
        prev?.width === width && prev?.height === height ? prev : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!ready || centredRef.current || gpsFailed) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled || centredRef.current) return
        centredRef.current = true
        map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        map.setZoom(GPS_ZOOM)
      },
      () => {
        if (!cancelled) setGpsFailed(true)
      },
      GPS_OPTIONS,
    )
    return () => {
      cancelled = true
    }
  }, [ready, map, gpsFailed])

  useEffect(() => {
    if (!ready || !gpsFailed || centredRef.current) return
    const start = lastFiberStart(fibers)
    if (!start) return
    centredRef.current = true
    map.setCenter(start)
    map.setZoom(PLACE_ZOOM)
  }, [ready, gpsFailed, fibers, map])

  const panTo = useCallback(({ latitude, longitude }, zoom = PLACE_ZOOM) => {
    mapRef.current?.panTo({ lat: latitude, lng: longitude })
    mapRef.current?.setZoom(zoom)
  }, [])

  const getCenter = useCallback(() => {
    const center = mapRef.current?.getCenter()
    return {
      latitude: center?.lat() ?? DEFAULT_CENTER.lat,
      longitude: center?.lng() ?? DEFAULT_CENTER.lng,
    }
  }, [])

  /** The locate button: re-centre on the device, `onError` gets a message. */
  const locate = useCallback((onError) => {
    if (!('geolocation' in navigator)) {
      onError?.('This device has no GPS')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        centredRef.current = true
        mapRef.current?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        mapRef.current?.setZoom(GPS_ZOOM)
      },
      () => {
        setLocating(false)
        onError?.('Could not get your location')
      },
      { ...GPS_OPTIONS, maximumAge: 0 },
    )
  }, [])

  return { containerRef, mapRef, map, ready, containerSize, panTo, getCenter, locate, locating }
}
