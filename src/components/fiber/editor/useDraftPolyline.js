'use client'

import { useCallback, useEffect, useRef } from 'react'
import { isPinned } from '@/lib/fiber/draft'
import { typedMarkerIcon, markerLabel } from '@/lib/fiber/markers'
import { coreColor } from '@/lib/fiber/constants'

const HIT_PX = 12 // context-menu / drag hit radius around a draft vertex
const WAYPOINT_MIN_ZOOM = 15 // plain waypoints are noise when zoomed out
const LABEL_MIN_ZOOM = 17 // labels only once individual poles are readable
const COORD_EPSILON = 1e-9 // LatLng round-trips are exact; guard float noise anyway

/** Pixel → LatLng. `projectionOverlay` is the empty OverlayView; null until it has a projection. */
export function pixelToLatLng(projectionOverlay, pixel) {
  const projection = projectionOverlay?.getProjection?.()
  if (!projection) return null
  return projection.fromContainerPixelToLatLng(new google.maps.Point(pixel.x, pixel.y))
}

/** LatLng → pixel (container coordinates). Null until the overlay has a projection. */
export function latLngToPixel(projectionOverlay, latLng) {
  const projection = projectionOverlay?.getProjection?.()
  if (!projection) return null
  return projection.fromLatLngToContainerPixel(latLng)
}

// markers.js only draws these kinds; anything else (BUILDING) borrows the
// waypoint dot but keeps its label and stays visible at every zoom.
const ICON_KINDS = new Set(['POP', 'CLOSURE', 'SPLITTER', 'WAYPOINT'])
const iconKind = (p) => {
  const kind = p.type === 'CLOSURE' && p.ref?.splitter ? 'SPLITTER' : p.type
  return ICON_KINDS.has(kind) ? kind : 'WAYPOINT'
}
const labelText = (p) => {
  if (p.type === 'WAYPOINT') return ''
  return p.ref?.name ?? p.ref?.code ?? (p.ref?.newClosure ? 'New' : (p.ref?.newPop?.name ?? ''))
}
// Rebuild trigger: anything that changes the SHAPE of the point list (order,
// identity, icon, label) — never the coordinates alone.
const signatureOf = (points) => points.map((p) => `${p.key}:${iconKind(p)}:${labelText(p)}`).join('|')

const mapsIcon = (icon) => ({
  url: icon.url,
  scaledSize: new google.maps.Size(icon.size, icon.size),
  anchor: new google.maps.Point(icon.anchor.x, icon.anchor.y),
})

// Ignore Google's own controls (zoom buttons, attribution links).
const isMapSurface = (event) => !event.target.closest('button, a, .gmnoprint, .gm-style-cc')

/**
 * Binds the pure fiber draft model to one editable Google polyline, its typed
 * vertex markers, the rubber band and the snap ring.
 *
 * Sync direction: the draft is the source of truth. The draft → map effect
 * rebuilds the MVCArray only when the point list's shape changed; map → draft
 * flows through the path's insert/set/remove listeners as reducer actions. Our
 * own writes to the path run under `syncingRef` so those listeners ignore them.
 *
 * Keeps all state in refs — no React state, so no effect ever calls setState.
 */
export function useDraftPolyline({ map, ready, draft, dispatch, drawing, coreCount, snapRing }) {
  const polylineRef = useRef(null)
  const pathRef = useRef(null)
  const keysRef = useRef([]) // mirrors the path order: index → point key
  const syncingRef = useRef(false) // true while WE write the path
  const markersRef = useRef([]) // [{ marker, isWaypoint, text }]
  const rubberRef = useRef(null)
  const ringRef = useRef(null)
  const projectionRef = useRef(null)
  const signatureRef = useRef(null)
  const applyZoomRef = useRef(() => {})
  // Mirrors so the map listeners, created once, always read current props.
  const mapRef = useRef(null)
  const draftRef = useRef(draft)
  const dispatchRef = useRef(dispatch)
  const drawingRef = useRef(drawing)
  const coreCountRef = useRef(coreCount)

  useEffect(() => {
    draftRef.current = draft
    dispatchRef.current = dispatch
    drawingRef.current = drawing
    coreCountRef.current = coreCount
  })

  // ---- draft → map ---------------------------------------------------------
  // Stable so the create effect can run it once the overlays exist (the draft
  // may already be populated before `ready` flips).
  const syncDraft = useCallback((points) => {
    const path = pathRef.current
    const map_ = mapRef.current
    if (!path || !map_) return
    const signature = signatureOf(points)

    if (signature === signatureRef.current) {
      // Shape unchanged — only coordinates can differ. The path already holds
      // the drag that produced them; a programmatic move still needs writing.
      syncingRef.current = true
      points.forEach((p, i) => {
        const vertex = path.getAt(i)
        if (!vertex) return
        if (Math.abs(vertex.lat() - p.latitude) > COORD_EPSILON || Math.abs(vertex.lng() - p.longitude) > COORD_EPSILON) {
          path.setAt(i, new google.maps.LatLng(p.latitude, p.longitude))
        }
      })
      syncingRef.current = false
      markersRef.current.forEach(({ marker }, i) => {
        const p = points[i]
        if (p) marker.setPosition({ lat: p.latitude, lng: p.longitude })
      })
      return
    }

    // Rebuild the whole path and the marker set.
    signatureRef.current = signature
    syncingRef.current = true
    path.clear()
    points.forEach((p) => path.push(new google.maps.LatLng(p.latitude, p.longitude)))
    syncingRef.current = false
    keysRef.current = points.map((p) => p.key)

    markersRef.current.forEach(({ marker }) => marker.setMap(null))
    markersRef.current = points.map((p, i) => {
      const text = labelText(p)
      // The last point is where the next tap extends from — highlight it.
      const icon = typedMarkerIcon(iconKind(p), {
        selected: i === points.length - 1,
      })
      return {
        marker: new google.maps.Marker({
          map: map_,
          position: { lat: p.latitude, lng: p.longitude },
          clickable: false,
          zIndex: 11,
          icon: mapsIcon(icon),
        }),
        isWaypoint: p.type === 'WAYPOINT',
        text,
      }
    })
    applyZoomRef.current()
  }, [])

  // ---- create the overlays once, wire every listener to refs ----------------
  useEffect(() => {
    if (!map || !ready) return
    mapRef.current = map

    // Pixel ↔ LatLng projection (an empty OverlayView is the documented way).
    const projectionOverlay = new google.maps.OverlayView()
    projectionOverlay.onAdd = () => {}
    projectionOverlay.draw = () => {}
    projectionOverlay.onRemove = () => {}
    projectionOverlay.setMap(map)
    projectionRef.current = projectionOverlay

    // Polylines take a FLAT path — an explicit MVCArray of LatLngs is the safe
    // construction on Maps JS v3.65 (the array shorthand breaks getPath()).
    const path = new google.maps.MVCArray([])
    const polyline = new google.maps.Polyline({
      map,
      path,
      strokeColor: coreColor(coreCountRef.current),
      strokeOpacity: 0.95,
      strokeWeight: 3,
      editable: true,
      clickable: false,
      zIndex: 10,
    })
    pathRef.current = path
    polylineRef.current = polyline

    const pointAt = (index) => {
      const key = keysRef.current[index]
      return key ? (draftRef.current.points.find((p) => p.key === key) ?? null) : null
    }

    // ---- map → draft -------------------------------------------------------
    const listeners = [
      path.addListener('set_at', (index) => {
        if (syncingRef.current) return
        const point = pointAt(index)
        if (!point) return
        // Google cannot pin a single vertex: snap a pinned one straight back.
        if (isPinned(point)) {
          syncingRef.current = true
          path.setAt(index, new google.maps.LatLng(point.latitude, point.longitude))
          syncingRef.current = false
          return
        }
        const latLng = path.getAt(index)
        dispatchRef.current({
          type: 'move',
          key: point.key,
          latitude: latLng.lat(),
          longitude: latLng.lng(),
        })
      }),
      path.addListener('insert_at', (index) => {
        if (syncingRef.current) return
        const latLng = path.getAt(index)
        // Keep the mirror aligned until the rebuild refills it with real keys.
        keysRef.current.splice(index, 0, null)
        dispatchRef.current({
          type: 'insert',
          index,
          point: { latitude: latLng.lat(), longitude: latLng.lng() },
        })
      }),
      path.addListener('remove_at', (index) => {
        if (syncingRef.current) return
        const key = keysRef.current[index]
        keysRef.current.splice(index, 1)
        if (key) dispatchRef.current({ type: 'remove', key })
      }),
    ]

    // ---- rubber band -------------------------------------------------------
    const rubber = new google.maps.Polyline({
      map,
      path: [],
      strokeColor: coreColor(coreCountRef.current),
      strokeOpacity: 0.5,
      strokeWeight: 2,
      clickable: false,
      zIndex: 9,
    })
    rubberRef.current = rubber

    // ---- snap ring ---------------------------------------------------------
    const ringIcon = typedMarkerIcon('SNAP_RING', { size: 24 })
    const ring = new google.maps.Marker({
      map,
      position: { lat: 0, lng: 0 },
      visible: false,
      clickable: false,
      zIndex: 12,
      icon: mapsIcon(ringIcon),
    })
    ringRef.current = ring

    // ---- zoom rules --------------------------------------------------------
    const applyZoom = () => {
      const zoom = mapRef.current?.getZoom() ?? 0
      markersRef.current.forEach(({ marker, isWaypoint, text }) => {
        marker.setVisible(!isWaypoint || zoom >= WAYPOINT_MIN_ZOOM)
        marker.setLabel(text && zoom >= LABEL_MIN_ZOOM ? markerLabel(text) : null)
      })
    }
    applyZoomRef.current = applyZoom
    const zoomListener = map.addListener('zoom_changed', applyZoom)

    // ---- rubber band DOM listeners (the map div, never the map's click) -----
    const container = map.getDiv()
    const containerPixel = (event) => {
      const rect = container.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const onMove = (event) => {
      const length = path.getLength()
      if (!drawingRef.current || length === 0 || !isMapSurface(event)) {
        rubber.setPath([])
        return
      }
      const latLng = pixelToLatLng(projectionRef.current, containerPixel(event))
      rubber.setPath(latLng ? [path.getAt(length - 1), latLng] : [])
    }
    const onLeave = () => rubber.setPath([])
    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseleave', onLeave)

    // The draft can already hold points (an edited route) before `ready` flips.
    syncDraft(draftRef.current.points)

    return () => {
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseleave', onLeave)
      listeners.forEach((listener) => google.maps.event.removeListener(listener))
      google.maps.event.removeListener(zoomListener)
      markersRef.current.forEach(({ marker }) => marker.setMap(null))
      markersRef.current = []
      keysRef.current = []
      signatureRef.current = null
      ring.setMap(null)
      rubber.setMap(null)
      polyline.setMap(null)
      projectionOverlay.setMap(null)
      pathRef.current = null
      polylineRef.current = null
      rubberRef.current = null
      ringRef.current = null
      projectionRef.current = null
      mapRef.current = null
    }
  }, [map, ready, syncDraft])

  useEffect(() => {
    syncDraft(draft.points)
  }, [draft.points, syncDraft])

  // ---- colour follows the core count --------------------------------------
  useEffect(() => {
    const strokeColor = coreColor(coreCount)
    polylineRef.current?.setOptions({ strokeColor })
    rubberRef.current?.setOptions({ strokeColor })
  }, [coreCount])

  // ---- leaving Draw mode drops the rubber band -----------------------------
  useEffect(() => {
    if (!drawing) rubberRef.current?.setPath([])
  }, [drawing])

  // ---- snap ring follows the hovered target -------------------------------
  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return
    if (snapRing) {
      ring.setPosition({ lat: snapRing.latitude, lng: snapRing.longitude })
      ring.setVisible(true)
    } else {
      ring.setVisible(false)
    }
  }, [snapRing])

  // Stable identity: usePointGesture puts this in an effect dependency array.
  const hitTest = useCallback((pixel) => {
    const path = pathRef.current
    const overlay = projectionRef.current
    if (!path || !overlay) return null
    let best = null
    let bestDist = HIT_PX
    for (let i = 0; i < path.getLength(); i++) {
      const vertexPixel = latLngToPixel(overlay, path.getAt(i))
      if (!vertexPixel) break // projection not ready yet
      const dist = Math.hypot(vertexPixel.x - pixel.x, vertexPixel.y - pixel.y)
      if (dist <= bestDist) {
        bestDist = dist
        best = keysRef.current[i] ?? null
      }
    }
    return best
  }, [])

  return { hitTest, projection: projectionRef }
}
