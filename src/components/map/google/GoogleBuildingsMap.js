'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { buildingColor, zoneColor } from '@/lib/constants'
import { buildingPin, pinDataUri, DECLUTTER_MAP_STYLE } from '@/lib/map-markers'

const polygonCentroid = (points) => ({
  lat: points.reduce((sum, p) => sum + p.latitude, 0) / points.length,
  lng: points.reduce((sum, p) => sum + p.longitude, 0) / points.length,
})

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // country-level fallback
const DEFAULT_ZOOM = 5
// Below this zoom, small zone polygons are near-invisible — show a colored
// dot notation at the centroid instead.
const ZONE_DETAIL_ZOOM = 13

/** Same contract as LeafletBuildingsMap — Google Maps JS implementation. */
export default function GoogleBuildingsMap({ buildings, zones = [], selectedId, onSelect }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const zoneOverlaysRef = useRef([])
  const fittedRef = useRef(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || mapRef.current) return
      mapRef.current = new Map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false, // building taps belong to OUR markers, not Google POIs
        styles: DECLUTTER_MAP_STYLE, // hide Google's POI icon clutter
      })
      setReady(true)
    })
    return () => {
      cancelled = true
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current.clear()
      mapRef.current = null
    }
  }, [])

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

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current.clear()

    buildings.forEach((building) => {
      const isSelected = building.id === selectedId
      const pin = buildingPin({
        color: buildingColor(building),
        selected: isSelected,
      })
      const marker = new google.maps.Marker({
        map,
        position: { lat: building.latitude, lng: building.longitude },
        icon: {
          url: pinDataUri(pin),
          scaledSize: new google.maps.Size(pin.width, pin.height),
          anchor: new google.maps.Point(pin.anchorX, pin.anchorY),
        },
        zIndex: isSelected ? 1000 : 1, // selected pin sits on top
      })
      marker.addListener('click', () => {
        onSelect(building)
        map.panTo({ lat: building.latitude, lng: building.longitude })
        if (map.getZoom() < 17) map.setZoom(17) // zoom in to the tapped building
      })
      markersRef.current.set(building.id, marker)
    })

    // Fit-to-all on first load (user decision) — later refetches keep the view.
    if (!fittedRef.current && buildings.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      buildings.forEach((b) => bounds.extend({ lat: b.latitude, lng: b.longitude }))
      map.fitBounds(bounds, 48)
      fittedRef.current = true
    }
  }, [buildings, selectedId, onSelect, ready])

  return <div ref={containerRef} className="relative isolate z-0 h-full w-full" />
}
