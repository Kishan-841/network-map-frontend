'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { buildingColor, zoneColor, LIVE_COLOR, NOT_LIVE_COLOR } from '@/lib/constants'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { buildingMarkerShape, buildingPinCached, clusterRenderer, DECLUTTER_MAP_STYLE } from '@/lib/map-markers'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'
import { useFiberOverlays } from '@/components/fiber/useFiberOverlays'
import { usePopMarkers } from '@/components/fiber/usePopMarkers'
import { focusPoints } from '@/lib/fiber/focus-target'
import { coreColor } from '@/lib/fiber/constants'

const polygonCentroid = (points) => ({
  lat: points.reduce((sum, p) => sum + p.latitude, 0) / points.length,
  lng: points.reduce((sum, p) => sum + p.longitude, 0) / points.length,
})

// A stable empty array: `useFiberOverlays` rebuilds whenever `fibers` changes
// identity, so a default of `[]` in the signature would rebuild every render.
const NO_FIBERS = []
const NO_POPS = []

const CENTRE_ZOOM = 17 // close enough to see the pole a point sits on
const FIT_PADDING = 64 // px of breathing room when framing a whole fiber

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // country-level fallback
const DEFAULT_ZOOM = 5

// Map instance pool: Google bills one "Dynamic Map load" per `new Map()`, so
// the main map is created ONCE per tab session and re-attached on every
// visit. Overlays (markers/zones/fiber) are still torn down per mount — only
// the billable Map object and its viewport survive. window.__mapLoads counts
// constructions so the saving is verifiable in the console.
let pooledMap = null
let pooledContainer = null
let pooledFitted = false
// Below this zoom, small zone polygons are near-invisible — show a colored
// dot notation at the centroid instead.
const ZONE_DETAIL_ZOOM = 13
const wingsKeyOf = (b) => (b.wings ?? []).map((w) => `${w.id}|${w.name}|${w.latitude}|${w.longitude}|${w.isLive}`).join(';')
// What a marker's icon depends on — a change re-icons just that marker.
const pinKeyOf = (building, selected) => `${buildingColor(building)}|${buildingMarkerShape(building)}|${selected}|${building.wings?.length ?? 0}`

// An approved society (source PERMISSION) gets a shield instead of the
// teardrop, in the same live / not-live colour.
const pinIcon = (building, selected) => {
  const pin = buildingPinCached({ color: buildingColor(building), selected, shape: buildingMarkerShape(building), badge: building.wings?.length ?? 0 })
  return {
    url: pin.url,
    scaledSize: new google.maps.Size(pin.width, pin.height),
    anchor: new google.maps.Point(pin.anchorX, pin.anchorY),
  }
}

/** Same contract as LeafletBuildingsMap — Google Maps JS implementation. */
export default function GoogleBuildingsMap({
  buildings,
  zones = [],
  fibers = NO_FIBERS,
  pops = NO_POPS,
  showClosures = true,
  showSplitters = true,
  selectedId,
  onSelect,
  onFiberSelect,
  onClosureSelect,
  onSplitterSelect,
  onPopSelect,
  centreRef,
  viewRef,
  searchPin = null,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const zoneOverlaysRef = useRef([])
  // Hovered fiber → floating details card at the cursor. Hover only: on touch
  // the same tap opens the detail panel, which says more than a card could.
  const [hover, setHover] = useState(null)
  const clustererRef = useRef(null)
  // "Frame this" — one handle used by every click on the map, and published
  // to the parent through centreRef for the detail panels.
  const focusRef = useRef(null)
  const expandRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const selectedIdRef = useRef(selectedId)
  const prevSelectedRef = useRef(null)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])
  const [ready, setReady] = useState(false)
  // The instance as state as well as a ref: `useFiberOverlays` takes it as an
  // argument, and a ref may not be read during render.
  const [map, setMap] = useState(null)
  const [layer, setLayer] = useMapLayer('tab', 'roadmap')

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || mapRef.current || !containerRef.current) return
      if (!pooledMap) {
        // The ONLY place a billable map load can happen for this page.
        pooledContainer = document.createElement('div')
        pooledContainer.style.width = '100%'
        pooledContainer.style.height = '100%'
        pooledMap = new Map(pooledContainer, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeId: layer, // 'roadmap' | 'satellite' | 'hybrid'
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false, // building taps belong to OUR markers, not Google POIs
          styles: DECLUTTER_MAP_STYLE, // hide Google's POI icon clutter
        })
        window.__mapLoads = (window.__mapLoads ?? 0) + 1
      }
      containerRef.current.appendChild(pooledContainer)
      mapRef.current = pooledMap
      // The panel's "centre on this point" handle. Published here rather than
      // from an effect so no render is involved — the parent only ever calls
      // it from an event.
      const focus = (target) => {
        const points = focusPoints(target)
        if (points.length === 0) return
        if (points.length === 1) {
          pooledMap.panTo(points[0])
          if ((pooledMap.getZoom() ?? 0) < CENTRE_ZOOM) pooledMap.setZoom(CENTRE_ZOOM)
          return
        }
        // A fiber is a line, so frame the whole run rather than centring on
        // wherever the tap landed. fitBounds settles asynchronously, hence the
        // one-shot idle listener to stop a short cable filling the screen.
        const bounds = new google.maps.LatLngBounds()
        points.forEach((point) => bounds.extend(point))
        pooledMap.fitBounds(bounds, FIT_PADDING)
        google.maps.event.addListenerOnce(pooledMap, 'idle', () => {
          if ((pooledMap.getZoom() ?? 0) > CENTRE_ZOOM) pooledMap.setZoom(CENTRE_ZOOM)
        })
      }
      focusRef.current = focus
      if (centreRef) centreRef.current = focus
      // Where the user is looking, so a place search finds the nearby match first.
      if (viewRef) {
        viewRef.current = () => {
          const centre = pooledMap.getCenter()
          return centre ? { latitude: centre.lat(), longitude: centre.lng() } : {}
        }
      }
      clustererRef.current = new MarkerClusterer({
        map: mapRef.current,
        markers: [],
        renderer: clusterRenderer,
      })
      setMap(pooledMap)
      setReady(true)
    })
    return () => {
      cancelled = true
      clustererRef.current?.clearMarkers()
      clustererRef.current = null
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current.clear()
      focusRef.current = null
      if (centreRef) centreRef.current = null
      if (viewRef) viewRef.current = null
      zoneOverlaysRef.current.forEach((overlay) => overlay.setMap(null))
      zoneOverlaysRef.current = []
      // Detach (never destroy) the pooled map so the next visit is free.
      if (pooledContainer?.parentNode) pooledContainer.parentNode.removeChild(pooledContainer)
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // One building's wings at a time (spec 2026-10-14): its pin hides and one
  // small labelled pin per wing shows; a wing click does what the building
  // click does. Clicking the map or zooming back out collapses it.
  const expandedIdRef = useRef(null)
  const wingMarkersRef = useRef([])
  const expandingRef = useRef(false) // fitBounds in flight: its zoom changes must not collapse
  const wingsKeyRef = useRef('')
  const clearWingMarkers = useCallback(() => {
    wingMarkersRef.current.forEach((m) => { google.maps.event.clearInstanceListeners(m); m.setMap(null) })
    wingMarkersRef.current = []
  }, [])
  const collapse = useCallback(() => {
    clearWingMarkers()
    const id = expandedIdRef.current
    expandedIdRef.current = null
    expandingRef.current = false
    wingsKeyRef.current = ''
    const pin = id && markersRef.current.get(id)
    if (pin) pin.setVisible(true)
  }, [clearWingMarkers])
  const drawWings = useCallback((building) => {
    const map = mapRef.current
    if (!map) return
    clearWingMarkers()
    wingsKeyRef.current = wingsKeyOf(building)
    wingMarkersRef.current = building.wings.map((wing) => {
      const m = new google.maps.Marker({
        map,
        position: { lat: wing.latitude, lng: wing.longitude },
        title: `${building.buildingName} · ${wing.name}`,
        label: { text: wing.name, color: '#ffffff', fontSize: '11px', fontWeight: '700' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: wing.isLive ? LIVE_COLOR : NOT_LIVE_COLOR, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
        zIndex: 2000,
      })
      m.addListener('click', () => onSelectRef.current(building))
      return m
    })
  }, [clearWingMarkers])
  const expand = useCallback((building) => {
    const map = mapRef.current
    if (!map) return
    collapse()
    expandedIdRef.current = building.id
    markersRef.current.get(building.id)?.setVisible(false)
    drawWings(building)
    const bounds = new google.maps.LatLngBounds()
    bounds.extend({ lat: building.latitude, lng: building.longitude })
    building.wings.forEach((w) => bounds.extend({ lat: w.latitude, lng: w.longitude }))
    expandingRef.current = true
    map.fitBounds(bounds, 80)
    // No idle fires if the view already fits — don't leave the flag stuck.
    setTimeout(() => { expandingRef.current = false }, 3000)
    google.maps.event.addListenerOnce(map, 'idle', () => {
      expandingRef.current = false
      if ((map.getZoom() ?? 0) > 19) map.setZoom(19)
    })
  }, [collapse, drawWings])

  useEffect(() => {
    if (!map || !ready) return
    expandRef.current = expand
    const clickL = map.addListener('click', collapse)
    const zoomL = map.addListener('zoom_changed', () => {
      if (expandedIdRef.current && !expandingRef.current && (map.getZoom() ?? 0) < 15) collapse()
    })
    return () => {
      clickL.remove()
      zoomL.remove()
      expandRef.current = null
      collapse()
    }
  }, [map, ready, expand, collapse])

  // Apply layer changes to the live map (initial value is set at creation).
  useEffect(() => {
    if (mapRef.current && ready) mapRef.current.setMapTypeId(layer)
  }, [layer, ready])

  // Zone boundaries: faint fill + dashed outline (Google polygons have no
  // native dash — the outline is a polyline of repeated dash symbols).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    zoneOverlaysRef.current.forEach((overlay) => overlay.setMap(null))
    zoneOverlaysRef.current = zones
      .map((zone, index) => ({ zone, color: zoneColor(index) }))
      .filter(({ zone }) => zone.boundary?.length >= 3)
      .flatMap(({ zone, color }) => {
        const path = zone.boundary.map((point) => ({
          lat: point.latitude,
          lng: point.longitude,
        }))
        const fill = new google.maps.Polygon({
          map,
          paths: path,
          strokeOpacity: 0,
          fillColor: color,
          fillOpacity: 0.12,
          clickable: false,
        })
        const dashedOutline = new google.maps.Polyline({
          map,
          path: [...path, path[0]], // close the ring
          strokeOpacity: 0,
          clickable: false,
          icons: [
            {
              icon: { path: 'M 0,-1.2 0,1.2', strokeOpacity: 1, strokeColor: color, scale: 2.5 },
              offset: '0',
              repeat: '14px',
            },
          ],
        })
        // Zone name floating at the polygon's centre — click to zoom to it.
        const label = new google.maps.Marker({
          map,
          position: polygonCentroid(zone.boundary),
          title: `Zoom to ${zone.name}`,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
          label: {
            text: zone.name.toUpperCase(),
            color,
            fontSize: '11px',
            fontWeight: '700',
          },
        })
        label.addListener('click', () => {
          const bounds = new google.maps.LatLngBounds()
          path.forEach((point) => bounds.extend(point))
          map.fitBounds(bounds, 48)
        })
        label.zoneColor = color
        return [fill, dashedOutline, label]
      })

    // Zoomed out: swap the invisible label anchor for a prominent colored
    // dot (name lifted above it) so small zones stay findable.
    const applyZoomStyle = () => {
      const zoomedOut = map.getZoom() < ZONE_DETAIL_ZOOM
      zoneOverlaysRef.current.forEach((overlay) => {
        if (!overlay.zoneColor) return
        overlay.setIcon(
          zoomedOut
            ? {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: overlay.zoneColor,
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                labelOrigin: new google.maps.Point(0, -2.4),
              }
            : { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        )
      })
    }
    applyZoomStyle()
    const zoomListener = map.addListener('zoom_changed', applyZoomStyle)
    return () => zoomListener.remove()
  }, [zones, ready])

  // Fiber: coloured lines by core count + one typed marker per real entity.
  // Everything about the drawing lives in the shared hook — this component
  // only says what a click and a hover mean on THIS map.
  useFiberOverlays({
    map,
    ready,
    fibers,
    dim: false,
    cluster: true,
    showClosures,
    showSplitters,
    onFiberClick: (fiber) => {
      onFiberSelect?.(fiber.id)
      // The whole cable, not the spot that was tapped.
      focusRef.current?.(fiber.points)
    },
    onPointClick: (point, fiber) => {
      // A closure — splitter icon or not — opens the closure drawer; a splitter
      // point opens its own drawer (which links to the fiber it sits on).
      if (point.type === 'CLOSURE' && point.closureId) onClosureSelect?.(point.closureId)
      else if (point.type === 'SPLITTER' && point.splitterId && onSplitterSelect) onSplitterSelect(point.splitterId)
      else if (point.type === 'SPLITTER' && fiber) onFiberSelect?.(fiber.id)
      // Bring the point into view, but keep the reader's zoom — jumping to
      // street level on every tap was jarring (and redrew the whole layer).
      map?.panTo({ lat: point.latitude, lng: point.longitude })
    },
    onFiberHover: (fiber, domEvent) => {
      if (!fiber || !domEvent) return setHover(null)
      setHover({
        x: domEvent.clientX,
        y: domEvent.clientY,
        name: fiber.name,
        coreCount: fiber.coreCount,
        operator: fiber.operator?.name,
      })
    },
  })

  // POPs: server-icon pins, their own legend layer, independent of Fiber.
  usePopMarkers({
    map,
    ready,
    pops,
    onPopClick: (pop) => {
      onPopSelect?.(pop)
      focusRef.current?.(pop.position)
    },
  })

  // The searched place: Google's own red pin, like Google Maps. Not clustered,
  // above every building and POP pin, and it never hides another layer.
  const searchLat = searchPin?.latitude
  const searchLng = searchPin?.longitude
  const searchLabel = searchPin?.label
  useEffect(() => {
    if (!map || !ready || searchLat == null || searchLng == null) return
    const marker = new google.maps.Marker({
      map,
      position: { lat: searchLat, lng: searchLng },
      title: searchLabel || 'Searched place',
      zIndex: google.maps.Marker.MAX_ZINDEX + 200000,
    })
    return () => marker.setMap(null)
  }, [map, ready, searchLat, searchLng, searchLabel])

  // Diff markers against the buildings prop — never tear down the world.
  // Selection is handled in its own effect so a tap only re-icons two pins.
  useEffect(() => {
    const map = mapRef.current
    const clusterer = clustererRef.current
    if (!map || !clusterer || !ready) return

    const markers = markersRef.current
    const seen = new Set()
    let changed = false

    buildings.forEach((building) => {
      seen.add(building.id)
      const selected = building.id === selectedIdRef.current
      const key = pinKeyOf(building, selected)
      let marker = markers.get(building.id)

      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: building.latitude, lng: building.longitude },
          icon: pinIcon(building, selected),
          title: building.buildingName, // native hover tooltip (like the POP pins)
          zIndex: selected ? 1000 : 1, // selected pin sits on top
        })
        marker.addListener('click', () => {
          const b = marker.buildingData
          if (b.wings?.length) {
            expandRef.current?.(b) // zoom to the wings and show wing pins; no drawer yet
            return
          }
          onSelectRef.current(b)
          focusRef.current?.(b)
        })
        marker.pinKey = key
        marker.buildingData = building
        markers.set(building.id, marker)
        clusterer.addMarker(marker, true)
        changed = true
        return
      }

      marker.buildingData = building
      if (marker.getTitle() !== building.buildingName) marker.setTitle(building.buildingName)
      const pos = marker.getPosition()
      if (pos.lat() !== building.latitude || pos.lng() !== building.longitude) {
        marker.setPosition({ lat: building.latitude, lng: building.longitude })
        changed = true
      }
      if (marker.pinKey !== key) {
        marker.setIcon(pinIcon(building, selected))
        marker.setZIndex(selected ? 1000 : 1)
        marker.pinKey = key
      }
    })

    markers.forEach((marker, id) => {
      if (seen.has(id)) return
      clusterer.removeMarker(marker, true)
      marker.setMap(null)
      markers.delete(id)
      changed = true
    })

    if (changed) clusterer.render()

    // A refresh (sales map quiet reload, markers invalidate) keeps the open
    // building open and redraws its wing pins from the new data.
    const openId = expandedIdRef.current
    if (openId) {
      const fresh = buildings.find((b) => b.id === openId)
      if (!fresh || !fresh.wings?.length) collapse()
      else {
        markers.get(openId)?.setVisible(false)
        if (wingsKeyOf(fresh) !== wingsKeyRef.current) drawWings(fresh)
      }
    }

    // Fit-to-all on first load (user decision) — later refetches keep the view.
    // Fit once per SESSION — revisits keep the viewport the user left at.
    if (!pooledFitted && buildings.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      buildings.forEach((b) => bounds.extend({ lat: b.latitude, lng: b.longitude }))
      map.fitBounds(bounds, 48)
      pooledFitted = true
    }
  }, [buildings, ready, collapse, drawWings])

  // Selection: restyle only the previously- and newly-selected pins.
  useEffect(() => {
    selectedIdRef.current = selectedId
    if (!ready) return
    const markers = markersRef.current

    const restyle = (id, selected) => {
      const marker = markers.get(id)
      if (!marker?.buildingData) return
      marker.setIcon(pinIcon(marker.buildingData, selected))
      marker.setZIndex(selected ? 1000 : 1)
      marker.pinKey = pinKeyOf(marker.buildingData, selected)
    }

    if (prevSelectedRef.current && prevSelectedRef.current !== selectedId) {
      restyle(prevSelectedRef.current, false)
    }
    if (selectedId) restyle(selectedId, true)
    prevSelectedRef.current = selectedId
  }, [selectedId, ready])

  return (
    <div className="relative isolate z-0 h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <MapLayerControl value={layer} onChange={setLayer} position="right-3 top-[4.75rem] lg:top-24" />

      {/* Fiber hover card — fixed at the cursor, like a rich tooltip. Hover
          only: a tap opens the detail panel instead. The fibers guard hides a
          stale card when the layer toggles off (no mouseout fires once the
          lines are gone). */}
      {hover && fibers.length > 0 && (
        <div
          className="pointer-events-none fixed z-50 w-56 rounded-card border border-line bg-card p-3 shadow-lift"
          style={{
            left: Math.min(hover.x + 14, window.innerWidth - 240),
            top: Math.min(hover.y + 14, window.innerHeight - 140),
          }}
        >
          <p className="truncate text-sm font-bold">{hover.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium">
            <span className="flex items-center gap-1.5 rounded-full bg-paper px-2 py-0.5 text-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: coreColor(hover.coreCount) }}
              />
              {hover.coreCount} core
            </span>
            {hover.operator && (
              <span className="rounded-full bg-fiber-tint px-2 py-0.5 text-fiber">
                {hover.operator}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
