'use client'

import { useEffect, useRef } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { clusterRenderer } from '@/lib/map-markers'
import { typedMarkerIcon, labelBadgeIcon } from '@/lib/fiber/markers'
import { coreColor } from '@/lib/fiber/constants'
import { polylineRanges, collectMarkers, markerText } from '@/lib/fiber/overlays'

const WAYPOINT_MIN_ZOOM = 15 // plain waypoints are noise when zoomed out
// Badges carry their own background, so they read far earlier than a bare
// label did; below this only hovering a (clickable) symbol reveals one.
const CLUSTER_MAX_ZOOM = 13 // below this, closures collapse into count bubbles

// Takes both icon shapes: a square symbol (`size`) and a badge (`width`/`height`).
const mapsIcon = (icon) => ({
  url: icon.url,
  scaledSize: new google.maps.Size(icon.width ?? icon.size, icon.height ?? icon.size),
  anchor: new google.maps.Point(icon.anchor.x, icon.anchor.y),
})

const latLngs = (points) => new google.maps.MVCArray(points.map((p) => new google.maps.LatLng(p.latitude, p.longitude)))

/**
 * Draws SAVED fibers — polylines and deduplicated typed markers — on any
 * Google map. Shared by the map page (full weight, interactive) and the
 * fiber editor (`dim`, as context behind the draft line).
 *
 * Everything lives in refs and is rebuilt whenever the inputs change. Markers
 * are created detached and only those on screen are attached once the view
 * settles; name badges are built on first need (the whole network is
 * thousands of points — attaching all of them is what lagged on zoom). Callbacks are mirrored into refs, so a caller passing a
 * fresh arrow function on every render never triggers a rebuild.
 */
export function useFiberOverlays({
  map,
  ready,
  fibers,
  exclude,
  dim = false,
  cluster = true,
  // Legend filters within the Fiber layer: hide closures / splitters on lines.
  showClosures = true,
  showSplitters = true,
  onFiberClick,
  onPointClick,
  onFiberHover,
}) {
  const polylinesRef = useRef([])
  const markersRef = useRef([]) // [{ marker, badge, isWaypoint }]
  const clusterableRef = useRef([]) // the subset the clusterer owns below z13
  const clustererRef = useRef(null)
  const clusteredRef = useRef(null) // null = never applied, so the first pass always runs
  // Mirrors so listeners, created once per build, always call the latest prop.
  const onFiberClickRef = useRef(onFiberClick)
  const onPointClickRef = useRef(onPointClick)
  const onFiberHoverRef = useRef(onFiberHover)
  // Read by the view pass, so flipping a filter re-attaches markers without
  // rebuilding the layer.
  const kindsRef = useRef({ CLOSURE: showClosures, SPLITTER: showSplitters })
  const applyViewRef = useRef(null)

  useEffect(() => {
    onFiberClickRef.current = onFiberClick
    onPointClickRef.current = onPointClick
    onFiberHoverRef.current = onFiberHover
  })

  useEffect(() => {
    if (!map || !ready) return
    const shown = (fibers ?? []).filter((fiber) => fiber.id !== exclude)

    // ---- polylines: one per segment, plus the dangling waypoint runs --------
    // Interactivity is a question of whether the caller wants events, nothing
    // else: a dim context line is still hoverable if a hover handler was given.
    const interactive = Boolean(onFiberClickRef.current || onFiberHoverRef.current)
    // The refs take the arrays BEFORE they are filled — they are mutated in
    // place, so a throw mid-build still leaves the cleanup a complete list.
    const polylines = []
    polylinesRef.current = polylines
    shown.forEach((fiber) => {
      polylineRanges(fiber).forEach((range) => {
        const line = new google.maps.Polyline({
          map,
          path: latLngs(range.points),
          strokeColor: coreColor(fiber.coreCount),
          strokeOpacity: dim ? 0.55 : 0.9,
          strokeWeight: dim ? 2.5 : 4,
          zIndex: 5,
          clickable: interactive,
        })
        if (onFiberClickRef.current) {
          line.addListener('click', (event) => onFiberClickRef.current?.(fiber, event.domEvent))
        }
        if (onFiberHoverRef.current) {
          const hover = (event) => onFiberHoverRef.current?.(fiber, event.domEvent)
          line.addListener('mouseover', hover)
          line.addListener('mousemove', hover)
          line.addListener('mouseout', () => onFiberHoverRef.current?.(null))
        }
        polylines.push(line)
      })
    })

    // ---- markers: one per real entity, however many fibers touch it --------
    const collected = collectMarkers(shown)
    // Behind the editor's draft (dim), the snap layer already draws every POP
    // and closure, and other lines' waypoints are only bends the polyline
    // shows anyway — drawing them again here meant thousands of extra markers,
    // all rebuilt after every save.
    const entities = dim
      ? collected.entities.filter(({ point }) => point.type !== 'CLOSURE' && point.type !== 'POP')
      : collected.entities
    const waypoints = dim ? [] : collected.waypoints
    const clickablePoints = Boolean(onPointClickRef.current)
    // Nothing is put on the map here: `applyView` attaches only what is on
    // screen once the view settles. The whole network is thousands of points.
    const markers = [] // [{ marker, point, text, kind, isWaypoint, clusterable, on, badge, icons, hovered }]
    markersRef.current = markers
    const clusterable = [] // closures/splitters only — POPs and buildings never cluster
    clusterableRef.current = clusterable

    // Names show on HOVER only (a click opens the drawer): drawing every name
    // in a dense area made an unreadable wall and lagged. A badge is BUILT the
    // first time its point is hovered, never up front for the whole network.
    const ensureBadge = (entry) => {
      if (entry.badge !== undefined) return entry.badge
      if (!entry.text) {
        entry.badge = null
        return null
      }
      entry.icons = { light: labelBadgeIcon(entry.text), dark: labelBadgeIcon(entry.text, { tone: 'dark' }) }
      entry.badge = new google.maps.Marker({
        map,
        position: entry.marker.getPosition(),
        clickable: false,
        visible: false,
        zIndex: 9,
        icon: mapsIcon(entry.icons.light),
      })
      return entry.badge
    }

    entities.forEach(({ kind, point, fibers: owners }) => {
      const entry = {
        marker: new google.maps.Marker({
          position: { lat: point.latitude, lng: point.longitude },
          icon: mapsIcon(typedMarkerIcon(kind, { size: dim ? 16 : 18 })),
          clickable: clickablePoints,
          zIndex: 8,
        }),
        point,
        kind,
        text: markerText(kind, point),
        isWaypoint: false,
        clusterable: kind === 'CLOSURE' || kind === 'SPLITTER',
        on: false,
        badge: undefined,
      }
      if (clickablePoints) {
        entry.marker.addListener('click', (event) => onPointClickRef.current?.(point, owners[0], event.domEvent))
        // Hover reveals this point's name. Hover only reaches a CLICKABLE
        // marker — the dim editor layer has no names at all.
        entry.marker.addListener('mouseover', () => {
          entry.hovered = true
          const badge = ensureBadge(entry)
          badge?.setIcon(mapsIcon(entry.icons.dark))
          badge?.setVisible(true)
        })
        entry.marker.addListener('mouseout', () => {
          entry.hovered = false
          entry.badge?.setIcon(mapsIcon(entry.icons.light))
          entry.badge?.setVisible(false)
        })
      }
      markers.push(entry)
      if (entry.clusterable) clusterable.push(entry.marker)
    })

    waypoints.forEach(({ point }) => {
      // Pure geometry: a waypoint has nothing to say, so it never gets a badge.
      markers.push({
        marker: new google.maps.Marker({
          position: { lat: point.latitude, lng: point.longitude },
          icon: mapsIcon(typedMarkerIcon('WAYPOINT', { size: 12 })),
          clickable: false,
          zIndex: 7,
        }),
        point,
        kind: 'WAYPOINT',
        text: null,
        isWaypoint: true,
        clusterable: false,
        on: false,
        badge: null,
      })
    })

    // ---- view rules --------------------------------------------------------
    clustererRef.current = cluster && clusterable.length ? new MarkerClusterer({ map, markers: [], renderer: clusterRenderer }) : null
    clusteredRef.current = null

    // Runs once the view SETTLES (`idle`), not on every step of a zoom:
    // attaches what is on screen (plus a margin, so a small pan doesn't pop),
    // detaches the rest, and only touches markers whose state changes.
    const kindShown = (entry) => kindsRef.current[entry.kind] ?? true
    let clusteredKinds = null // which kinds the clusterer was last handed
    const applyView = () => {
      const bounds = map.getBounds()
      if (!bounds) return
      const zoom = map.getZoom() ?? 0

      const clusterer = clustererRef.current
      const clustered = Boolean(clusterer) && zoom < CLUSTER_MAX_ZOOM
      const kindsKey = `${kindsRef.current.CLOSURE}|${kindsRef.current.SPLITTER}`
      if (clusterer && (clustered !== clusteredRef.current || (clustered && kindsKey !== clusteredKinds))) {
        clusteredRef.current = clustered
        clusteredKinds = kindsKey
        clusterer.clearMarkers()
        if (clustered) {
          // The clusterer draws them itself, as count bubbles.
          markers.forEach((entry) => {
            if (entry.clusterable && entry.on) {
              entry.marker.setMap(null)
              entry.on = false
            }
          })
          clusterer.addMarkers(markers.filter((entry) => entry.clusterable && kindShown(entry)).map((entry) => entry.marker))
        }
      }

      const ne = bounds.getNorthEast()
      const sw = bounds.getSouthWest()
      const padLat = (ne.lat() - sw.lat()) * 0.25
      const padLng = (ne.lng() - sw.lng()) * 0.25
      const inView = ({ latitude, longitude }) =>
        latitude <= ne.lat() + padLat && latitude >= sw.lat() - padLat &&
        longitude <= ne.lng() + padLng && longitude >= sw.lng() - padLng

      for (const entry of markers) {
        const want = inView(entry.point) && kindShown(entry) &&
          (entry.isWaypoint ? zoom >= WAYPOINT_MIN_ZOOM : !(entry.clusterable && clustered))
        if (want !== entry.on) {
          entry.marker.setMap(want ? map : null)
          entry.on = want
        }
      }
    }
    applyViewRef.current = applyView
    applyView()
    const viewListener = map.addListener('idle', applyView)

    return () => {
      google.maps.event.removeListener(viewListener)
      // clearMarkers only empties the list; the clusterer is an OverlayView
      // holding an `idle` listener on the map, and only setMap(null) (→
      // onRemove) gives that back. Without it every rebuild leaks one.
      clustererRef.current?.clearMarkers()
      clustererRef.current?.setMap(null)
      clustererRef.current = null
      clusteredRef.current = null
      markersRef.current.forEach(({ marker, badge }) => {
        google.maps.event.clearInstanceListeners(marker)
        marker.setMap(null)
        badge?.setMap(null)
      })
      polylinesRef.current.forEach((line) => {
        google.maps.event.clearInstanceListeners(line)
        line.setMap(null)
      })
      markersRef.current = []
      polylinesRef.current = []
      clusterableRef.current = []
      applyViewRef.current = null
    }
  }, [map, ready, fibers, exclude, dim, cluster])

  // A legend filter changed: re-run the view pass, no rebuild.
  useEffect(() => {
    kindsRef.current = { CLOSURE: showClosures, SPLITTER: showSplitters }
    applyViewRef.current?.()
  }, [showClosures, showSplitters])
}
