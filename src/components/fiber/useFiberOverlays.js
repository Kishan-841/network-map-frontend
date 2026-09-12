'use client'

import { useEffect, useRef } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { clusterRenderer } from '@/lib/map-markers'
import { typedMarkerIcon, markerLabel } from '@/lib/fiber/markers'
import { coreColor } from '@/lib/fiber/constants'
import { polylineRanges, collectMarkers, markerText } from '@/lib/fiber/overlays'

const WAYPOINT_MIN_ZOOM = 15 // plain waypoints are noise when zoomed out
const LABEL_MIN_ZOOM = 17 // labels only once individual poles are readable
const CLUSTER_MAX_ZOOM = 13 // below this, closures collapse into count bubbles

const mapsIcon = (icon) => ({
  url: icon.url,
  scaledSize: new google.maps.Size(icon.size, icon.size),
  anchor: new google.maps.Point(icon.anchor.x, icon.anchor.y),
})

const latLngs = (points) => new google.maps.MVCArray(points.map((p) => new google.maps.LatLng(p.latitude, p.longitude)))

// The red dashed twin laid over a cut segment: a transparent line whose only
// visible content is the repeating dash symbol.
const CUT_OPTIONS = {
  strokeColor: '#dc2626',
  strokeOpacity: 0,
  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#dc2626', scale: 4 }, offset: '0', repeat: '20px' }],
  zIndex: 6,
  clickable: false,
}

/**
 * Draws SAVED fibers — polylines, deduplicated typed markers, cut overlays —
 * on any Google map. Shared by the map page (full weight, interactive) and the
 * fiber editor (`dim`, as context behind the draft line).
 *
 * Everything lives in refs and is rebuilt wholesale whenever the inputs change:
 * the fiber list is small and identity-stable per fetch, so diffing would cost
 * more than it saves. Callbacks are mirrored into refs, so a caller passing a
 * fresh arrow function on every render never triggers a rebuild.
 */
export function useFiberOverlays({ map, ready, fibers, exclude, dim = false, cluster = true, onFiberClick, onPointClick, onFiberHover }) {
  const polylinesRef = useRef([])
  const markersRef = useRef([]) // [{ marker, isWaypoint, text }]
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
    const hoverable = Boolean(onFiberClickRef.current || onFiberHoverRef.current)
    const polylines = []
    shown.forEach((fiber) => {
      polylineRanges(fiber).forEach((range) => {
        const line = new google.maps.Polyline({
          map,
          path: latLngs(range.points),
          strokeColor: coreColor(fiber.coreCount),
          strokeOpacity: dim ? 0.55 : 0.9,
          strokeWeight: dim ? 2.5 : 4,
          zIndex: 5,
          clickable: !dim && hoverable,
        })
        if (!dim) {
          if (onFiberClickRef.current) {
            line.addListener('click', (event) => onFiberClickRef.current?.(fiber, event.domEvent))
          }
          if (onFiberHoverRef.current) {
            const hover = (event) => onFiberHoverRef.current?.(fiber, event.domEvent)
            line.addListener('mouseover', hover)
            line.addListener('mousemove', hover)
            line.addListener('mouseout', () => onFiberHoverRef.current?.(null))
          }
        }
        polylines.push(line)
        if (range.isCut) {
          polylines.push(new google.maps.Polyline({ map, path: latLngs(range.points), ...CUT_OPTIONS }))
        }
      })
    })

    // ---- markers: one per real entity, however many fibers touch it --------
    const { entities, waypoints } = collectMarkers(shown)
    const clickablePoints = Boolean(onPointClickRef.current)
    const markers = []
    const clusterable = [] // closures/splitters only — POPs and buildings never cluster

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
      // Zoomed out the labels are hidden; hovering one reveals just that name.
      if (text) {
        marker.addListener('mouseover', () => marker.setLabel(markerLabel(text)))
        marker.addListener('mouseout', () => {
          if ((map.getZoom() ?? 0) < LABEL_MIN_ZOOM) marker.setLabel(null)
        })
      }
      markers.push({ marker, isWaypoint: false, text })
      if (kind === 'CLOSURE' || kind === 'SPLITTER') clusterable.push(marker)
    })

    waypoints.forEach(({ point }) => {
      markers.push({
        marker: new google.maps.Marker({
          map,
          position: { lat: point.latitude, lng: point.longitude },
          icon: mapsIcon(typedMarkerIcon('WAYPOINT', { size: 12 })),
          clickable: false,
          zIndex: 7,
        }),
        isWaypoint: true,
        text: '',
      })
    })

    polylinesRef.current = polylines
    markersRef.current = markers
    clusterableRef.current = clusterable

    // ---- zoom rules --------------------------------------------------------
    clustererRef.current = cluster && clusterable.length ? new MarkerClusterer({ map, markers: [], renderer: clusterRenderer }) : null
    clusteredRef.current = null

    const applyZoom = () => {
      const zoom = map.getZoom() ?? 0
      markersRef.current.forEach(({ marker, isWaypoint, text }) => {
        if (isWaypoint) marker.setVisible(zoom >= WAYPOINT_MIN_ZOOM)
        else marker.setLabel(text && zoom >= LABEL_MIN_ZOOM ? markerLabel(text) : null)
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
      clustererRef.current?.clearMarkers()
      clustererRef.current = null
      clusteredRef.current = null
      markersRef.current.forEach(({ marker }) => {
        google.maps.event.clearInstanceListeners(marker)
        marker.setMap(null)
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
