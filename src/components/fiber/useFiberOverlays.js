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
const BADGE_MIN_ZOOM = 15
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
 * Everything lives in refs and is rebuilt wholesale whenever the inputs change:
 * the fiber list is small and identity-stable per fetch, so diffing would cost
 * more than it saves. Callbacks are mirrored into refs, so a caller passing a
 * fresh arrow function on every render never triggers a rebuild.
 */
export function useFiberOverlays({ map, ready, fibers, exclude, dim = false, cluster = true, onFiberClick, onPointClick, onFiberHover }) {
  const polylinesRef = useRef([])
  const markersRef = useRef([]) // [{ marker, badge, isWaypoint }]
  const clusterableRef = useRef([]) // the subset the clusterer owns below z13
  const clustererRef = useRef(null)
  const clusteredRef = useRef(null) // null = never applied, so the first pass always runs
  // Mirrors so listeners, created once per build, always call the latest prop.
  const onFiberClickRef = useRef(onFiberClick)
  const onPointClickRef = useRef(onPointClick)
  const onFiberHoverRef = useRef(onFiberHover)

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
    const { entities, waypoints } = collectMarkers(shown)
    const clickablePoints = Boolean(onPointClickRef.current)
    const markers = []
    markersRef.current = markers
    const clusterable = [] // closures/splitters only — POPs and buildings never cluster
    clusterableRef.current = clusterable

    entities.forEach(({ kind, point, fibers: owners }) => {
      const text = markerText(kind, point)
      const marker = new google.maps.Marker({
        map,
        position: { lat: point.latitude, lng: point.longitude },
        icon: mapsIcon(typedMarkerIcon(kind, { size: dim ? 16 : 18 })),
        clickable: clickablePoints,
        zIndex: 8,
      })
      if (clickablePoints) {
        marker.addListener('click', (event) => onPointClickRef.current?.(point, owners[0], event.domEvent))
      }
      // The code/ratio rides ABOVE the symbol on its own marker, so the teal
      // circle / orange diamond underneath stays visible.
      const badgeIcons = text ? { light: labelBadgeIcon(text), dark: labelBadgeIcon(text, { tone: 'dark' }) } : null
      const badge = badgeIcons
        ? new google.maps.Marker({
            map,
            position: { lat: point.latitude, lng: point.longitude },
            clickable: false,
            visible: false, // applyZoom below has the final say
            zIndex: 9,
            icon: mapsIcon(badgeIcons.light),
          })
        : null
      // Zoomed out the badges are hidden; hovering one reveals just that name.
      // Hover only reaches a CLICKABLE marker — the dim editor context layer
      // passes no click handler, so it gets no hover either.
      if (badge && clickablePoints) {
        marker.addListener('mouseover', () => {
          badge.setIcon(mapsIcon(badgeIcons.dark))
          badge.setVisible(true)
        })
        marker.addListener('mouseout', () => {
          badge.setIcon(mapsIcon(badgeIcons.light))
          badge.setVisible((map.getZoom() ?? 0) >= BADGE_MIN_ZOOM)
        })
      }
      markers.push({ marker, badge, isWaypoint: false })
      if (kind === 'CLOSURE' || kind === 'SPLITTER') clusterable.push(marker)
    })

    waypoints.forEach(({ point }) => {
      // Pure geometry: a waypoint has nothing to say, so it never gets a badge.
      markers.push({
        marker: new google.maps.Marker({
          map,
          position: { lat: point.latitude, lng: point.longitude },
          icon: mapsIcon(typedMarkerIcon('WAYPOINT', { size: 12 })),
          clickable: false,
          zIndex: 7,
        }),
        badge: null,
        isWaypoint: true,
      })
    })

    // ---- zoom rules --------------------------------------------------------
    clustererRef.current = cluster && clusterable.length ? new MarkerClusterer({ map, markers: [], renderer: clusterRenderer }) : null
    clusteredRef.current = null

    const applyZoom = () => {
      const zoom = map.getZoom() ?? 0
      markersRef.current.forEach(({ marker, badge, isWaypoint }) => {
        if (isWaypoint) marker.setVisible(zoom >= WAYPOINT_MIN_ZOOM)
        else badge?.setVisible(zoom >= BADGE_MIN_ZOOM)
      })
      const clusterer = clustererRef.current
      if (!clusterer) return
      const clustered = zoom < CLUSTER_MAX_ZOOM
      if (clustered === clusteredRef.current) return
      clusteredRef.current = clustered
      if (clustered) {
        // addMarkers draws them itself, as cluster bubbles.
        clusterableRef.current.forEach((marker) => marker.setMap(null))
        clusterer.addMarkers(clusterableRef.current)
      } else {
        clusterer.clearMarkers()
        clusterableRef.current.forEach((marker) => marker.setMap(map))
      }
    }
    applyZoom()
    const zoomListener = map.addListener('zoom_changed', applyZoom)

    return () => {
      google.maps.event.removeListener(zoomListener)
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
    }
  }, [map, ready, fibers, exclude, dim, cluster])
}
