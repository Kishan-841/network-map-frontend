'use client'

import { useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { getMapProvider } from '@/lib/map-providers'
import { buildingColor, zoneColor } from '@/lib/constants'
import { DECLUTTER_MAP_STYLE } from '@/lib/map-markers'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'
import { Button } from '@/components/ui/Button'
import { IconSearch } from '@/components/ui/icons'

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // country-level fallback
const DEFAULT_ZOOM = 5
const MAX_POINTS = 100 // API cap (zone.schemas.js)
const EDIT_COLOR = '#0e7569' // --color-fiber

/**
 * Full-screen draw/edit surface for a zone boundary. One editable polygon is
 * the source of truth: map clicks append vertices, Google's handles drag and
 * insert them, Undo pops the last. Done extracts the path in API shape
 * ({ latitude, longitude }); nothing persists here — the zone form saves.
 */
export default function GoogleBoundaryMapEditor({
  zoneName,
  excludeZoneId,
  initialPoints = [],
  onDone,
  onCancel,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const polygonRef = useRef(null)
  const pathRef = useRef(null)
  const numberMarkersRef = useRef([])
  const rubberRef = useRef(null)
  const overlaysRef = useRef([]) // building dots + other-zone outlines
  const zonesShownRef = useRef(true)
  const [ready, setReady] = useState(false)
  const [pointCount, setPointCount] = useState(initialPoints.length)
  const [zonesShown, setZonesShown] = useState(true)
  const [layer, setLayer] = useMapLayer('boundary', 'hybrid')

  // Location search (same provider stack as the add-building flow).
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState([])

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || mapRef.current || !containerRef.current) return
      const map = new Map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: layer,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        styles: DECLUTTER_MAP_STYLE,
      })
      mapRef.current = map

      // Own the path as an explicit MVCArray: on current Maps JS builds a
      // polygon constructed with an EMPTY paths array returns undefined from
      // getPath(), so we hand the polygon our array and never ask for it back.
      const path = new google.maps.MVCArray(
        initialPoints.map((p) => new google.maps.LatLng(p.latitude, p.longitude)),
      )
      const polygon = new google.maps.Polygon({
        map,
        paths: path,
        strokeColor: EDIT_COLOR,
        strokeWeight: 2,
        fillColor: EDIT_COLOR,
        fillOpacity: 0.2,
        editable: true,
        draggable: false,
        zIndex: 10,
      })
      polygonRef.current = polygon
      pathRef.current = path

      // Numbered dots on every vertex — rebuilt on any path change (≤100, cheap).
      const renderNumbers = () => {
        numberMarkersRef.current.forEach((m) => m.setMap(null))
        numberMarkersRef.current = []
        for (let i = 0; i < path.getLength(); i++) {
          numberMarkersRef.current.push(
            new google.maps.Marker({
              map,
              position: path.getAt(i),
              clickable: false,
              zIndex: 11,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: EDIT_COLOR,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
              label: { text: String(i + 1), color: '#ffffff', fontSize: '10px', fontWeight: '700' },
            }),
          )
        }
      }
      const syncCount = () => {
        setPointCount(path.getLength())
        renderNumbers()
      }
      path.addListener('insert_at', syncCount)
      path.addListener('remove_at', syncCount)
      path.addListener('set_at', syncCount)

      // Click appends the next vertex (drawing and refining share one mode).
      map.addListener('click', (event) => {
        if (!event.latLng || path.getLength() >= MAX_POINTS) return
        path.push(event.latLng)
      })

      // Rubber band from the last vertex to the cursor (desktop only).
      const rubber = new google.maps.Polyline({
        map,
        path: [],
        strokeColor: EDIT_COLOR,
        strokeOpacity: 0.5,
        strokeWeight: 2,
        clickable: false,
        zIndex: 9,
      })
      rubberRef.current = rubber
      map.addListener('mousemove', (event) => {
        const len = path.getLength()
        if (!event.latLng || len === 0 || len >= MAX_POINTS) {
          rubber.setPath([])
          return
        }
        rubber.setPath([path.getAt(len - 1), event.latLng])
      })
      map.addListener('mouseout', () => rubber.setPath([]))

      // Right-click a vertex to remove it (Undo covers the common case).
      polygon.addListener('rightclick', (event) => {
        if (event.vertex !== undefined) path.removeAt(event.vertex)
      })

      // Start where the work is: the existing boundary, else the default view.
      if (initialPoints.length > 0) {
        const bounds = new google.maps.LatLngBounds()
        initialPoints.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }))
        map.fitBounds(bounds, 64)
      }

      renderNumbers()
      setReady(true)
    })
    return () => {
      cancelled = true
      polygonRef.current?.setMap(null)
      numberMarkersRef.current.forEach((m) => m.setMap(null))
      overlaysRef.current.forEach((o) => o.setMap(null))
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mapRef.current && ready) mapRef.current.setMapTypeId(layer)
  }, [layer, ready])

  // Context overlays: faded building dots + faint other-zone outlines.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    let cancelled = false
    Promise.all([
      apiClient.get('/buildings', { params: { pageSize: 500 } }).catch(() => null),
      apiClient.get('/zones').catch(() => null),
    ]).then(([buildingsRes, zonesRes]) => {
      if (cancelled || !mapRef.current) return
      const overlays = []
      for (const building of buildingsRes?.data.data.items ?? []) {
        overlays.push(
          new google.maps.Marker({
            map,
            position: { lat: building.latitude, lng: building.longitude },
            clickable: false,
            zIndex: 2,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 5,
              fillColor: buildingColor(building),
              fillOpacity: 0.5,
              strokeColor: '#ffffff',
              strokeWeight: 1,
            },
          }),
        )
      }
      const zones = (zonesRes?.data.data ?? []).filter(
        (zone) => zone.id !== excludeZoneId && zone.boundary?.length >= 3,
      )
      zones.forEach((zone, index) => {
        const overlay = new google.maps.Polygon({
          map: zonesShownRef.current ? map : null,
          paths: zone.boundary.map((p) => ({ lat: p.latitude, lng: p.longitude })),
          strokeColor: zoneColor(index),
          strokeOpacity: 0.6,
          strokeWeight: 1.5,
          fillColor: zoneColor(index),
          fillOpacity: 0.06,
          clickable: false,
          zIndex: 1,
        })
        overlay.isZoneOverlay = true
        overlays.push(overlay)
      })
      overlaysRef.current = overlays
    })
    return () => {
      cancelled = true
    }
  }, [ready, excludeZoneId])

  // Toggle only the zone outlines; building dots always show.
  useEffect(() => {
    zonesShownRef.current = zonesShown
    overlaysRef.current.forEach((overlay) => {
      if (overlay.isZoneOverlay) overlay.setMap(zonesShown ? mapRef.current : null)
    })
  }, [zonesShown])

  // Debounced location search via the existing provider stack. Short inputs
  // clear the list through the same timer (no synchronous setState in effects).
  useEffect(() => {
    const input = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        if (input.length < 3) {
          setPredictions([])
          return
        }
        const center = mapRef.current?.getCenter()
        getMapProvider()
          .autocomplete({
            input,
            latitude: center?.lat() ?? DEFAULT_CENTER.lat,
            longitude: center?.lng() ?? DEFAULT_CENTER.lng,
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
    mapRef.current?.panTo({ lat: latitude, lng: longitude })
    mapRef.current?.setZoom(15)
  }

  function handleUndo() {
    const path = pathRef.current
    if (path?.getLength() > 0) path.removeAt(path.getLength() - 1)
  }

  function handleClear() {
    pathRef.current?.clear()
  }

  function handleDone() {
    const path = pathRef.current
    const points = []
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i)
      points.push({ latitude: point.lat(), longitude: point.lng() })
    }
    onDone(points)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Zone boundary</p>
          <p className="truncate font-bold">{zoneName?.trim() || 'New zone'}</p>
        </div>
        <p className="text-sm tabular-nums text-muted">
          {pointCount} point{pointCount === 1 ? '' : 's'}
          {pointCount < 3 && ' — need at least 3'}
          {pointCount >= MAX_POINTS && ` — limit ${MAX_POINTS}`}
        </p>
        <Button variant="secondary" onClick={handleUndo} disabled={pointCount === 0}>
          Undo
        </Button>
        <Button variant="dangerGhost" onClick={handleClear} disabled={pointCount === 0}>
          Clear
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleDone} disabled={pointCount < 3}>
          Done
        </Button>
      </div>

      {/* Map + floating controls */}
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />

        <div className="absolute left-3 top-3 z-10 w-72 max-w-[calc(100%-6rem)]">
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

        <label className="absolute bottom-4 left-3 z-10 flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-xs font-medium shadow-md">
          <input
            type="checkbox"
            checked={zonesShown}
            onChange={(e) => setZonesShown(e.target.checked)}
            className="checkbox checkbox-xs"
          />
          Other zones
        </label>

        <MapLayerControl value={layer} onChange={setLayer} position="right-3 top-3" />

        <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-card/90 px-4 py-1.5 text-xs text-muted shadow">
          Click the map to add points · drag handles to adjust · right-click a point to remove it
        </p>
      </div>
    </div>
  )
}
