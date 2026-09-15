'use client'

import { useCallback, useEffect, useRef } from 'react'
import { isPinned } from '@/lib/fiber/draft'
import { nearestPointOnPath } from '@/lib/fiber/line-hit'
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

// A closure that carries a splitter draws as a splitter; every other point
// draws as its own type (markers.js throws on a kind it cannot draw).
const iconKind = (p) => (p.type === 'CLOSURE' && p.ref?.splitter ? 'SPLITTER' : p.type)
const labelText = (p) => {
  if (p.type === 'WAYPOINT') return ''
  return p.ref?.name ?? p.ref?.code ?? (p.ref?.newClosure ? 'New' : (p.ref?.newPop?.name ?? ''))
}
// Rebuild trigger: anything that changes the SHAPE of the point list (order,
// identity, type, icon, label) — never the coordinates alone. The raw type is
// in the key as well as the icon kind: two different types can share an icon
// but still differ in the zoom rules (only a real WAYPOINT hides below z15).
const signatureOf = (points) => points.map((p) => `${p.key}:${p.type}:${iconKind(p)}:${labelText(p)}`).join('|')

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
export function useDraftPolyline({ map, ready, draft, dispatch, drawing, coreCount, snapRing, pointsClickable = false, onClosureClick }) {
  const polylineRef = useRef(null)
  const pathRef = useRef(null)
  const keysRef = useRef([]) // mirrors the path order: index → point key
  const syncingRef = useRef(false) // true while WE write the path
  const markersRef = useRef([]) // [{ marker, isWaypoint, text, isClickableClosure }]
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
  const snapRingRef = useRef(snapRing)
  const pointsClickableRef = useRef(pointsClickable)
  const onClosureClickRef = useRef(onClosureClick)

  useEffect(() => {
    draftRef.current = draft
    dispatchRef.current = dispatch
    drawingRef.current = drawing
    coreCountRef.current = coreCount
    snapRingRef.current = snapRing
    pointsClickableRef.current = pointsClickable
    onClosureClickRef.current = onClosureClick
  })

  // ---- snap ring follows the hovered target -------------------------------
  // Stable for the same reason as syncDraft: the create effect replays it.
  const applySnapRing = useCallback((target) => {
    const ring = ringRef.current
    if (!ring) return
    if (target) ring.setPosition({ lat: target.latitude, lng: target.longitude })
    ring.setVisible(Boolean(target))
  }, [])

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
      // Only a SAVED closure (it has a code) carries a type/note worth a card —
      // and only in annotate + Pan mode, where a tap can never mean "draw".
      const isClickableClosure = p.type === 'CLOSURE' && Boolean(p.ref?.closureId)
      const marker = new google.maps.Marker({
        map: map_,
        position: { lat: p.latitude, lng: p.longitude },
        clickable: isClickableClosure && pointsClickableRef.current,
        zIndex: 11,
        icon: mapsIcon(icon),
      })
      if (isClickableClosure) {
        marker.addListener('click', () => onClosureClickRef.current?.(p))
      }
      return {
        marker,
        isWaypoint: p.type === 'WAYPOINT',
        text,
        isClickableClosure,
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
      // Editable ONLY while the line is being drawn: Google's ghost midpoint
      // handles sit exactly where a closure is aimed and swallow the tap that
      // should place it, and a stray drag in Pan mode would move the route.
      editable: drawingRef.current,
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

    // The draft — and a hovered snap target — can already exist before `ready`
    // flips, and neither prop changes identity afterwards to trigger its effect.
    syncDraft(draftRef.current.points)
    applySnapRing(snapRingRef.current)

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
  }, [map, ready, syncDraft, applySnapRing])

  useEffect(() => {
    syncDraft(draft.points)
  }, [draft.points, syncDraft])

  // ---- colour follows the core count --------------------------------------
  useEffect(() => {
    const strokeColor = coreColor(coreCount)
    polylineRef.current?.setOptions({ strokeColor })
    rubberRef.current?.setOptions({ strokeColor })
  }, [coreCount])

  // ---- leaving Draw mode drops the rubber band and the vertex handles ------
  useEffect(() => {
    polylineRef.current?.setOptions({ editable: drawing })
    if (!drawing) rubberRef.current?.setPath([])
  }, [drawing])

  // A mode switch (e.g. Pan ↔ Draw) never changes the point list itself, so
  // `syncDraft` never re-runs for it — flip clickability on the existing
  // closure markers directly instead of waiting for a rebuild.
  useEffect(() => {
    markersRef.current.forEach(({ marker, isClickableClosure }) => {
      if (isClickableClosure) marker.setClickable(pointsClickable)
    })
  }, [pointsClickable])

  useEffect(() => {
    applySnapRing(snapRing)
  }, [snapRing, applySnapRing])

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

  // Nearest point ON the line (not on a vertex): where an inserted closure
  // goes. `index` is the vertex it follows — insert at `index + 1`.
  const hitTestLine = useCallback((pixel) => {
    const path = pathRef.current
    const overlay = projectionRef.current
    if (!path || !overlay) return null
    const pixels = []
    for (let i = 0; i < path.getLength(); i++) {
      const vertexPixel = latLngToPixel(overlay, path.getAt(i))
      if (!vertexPixel) return null // projection not ready yet
      pixels.push({ x: vertexPixel.x, y: vertexPixel.y })
    }
    const hit = nearestPointOnPath(pixels, pixel, HIT_PX)
    if (!hit) return null
    const latLng = pixelToLatLng(overlay, hit)
    if (!latLng) return null
    return { index: hit.index, latitude: latLng.lat(), longitude: latLng.lng() }
  }, [])

  return { hitTest, hitTestLine, projection: projectionRef }
}
