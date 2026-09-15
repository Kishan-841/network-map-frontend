'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { apiClient } from '@/lib/api-client'
import { zoneColor } from '@/lib/constants'
import { buildingDotIcon, clusterRenderer } from '@/lib/map-markers'
import { typedMarkerIcon, markerLabel } from '@/lib/fiber/markers'

const LABEL_MIN_ZOOM = 16 // POP / closure names only once the area is readable
// useSnapTargets carries no live flag, so building dots stay neutral here —
// colour would imply a status the editor cannot know.
const BUILDING_DOT_COLOR = '#64748b'

const PREF_KEYS = {
  buildings: 'fiber-buildings-shown',
  zones: 'fiber-zones-shown',
  others: 'fiber-others-shown',
}

// Overlay choices persist across sessions (same idea as useMapLayer).
const readPref = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === '1'
  } catch {
    return fallback
  }
}
const writePref = (key, value) => {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Private mode — the toggle still works for this session.
  }
}

/** Remembered Buildings / Zones / Other-fiber toggles. */
export function useOverlayToggles() {
  const [overlays, setOverlays] = useState(() => ({
    buildings: readPref(PREF_KEYS.buildings, false),
    zones: readPref(PREF_KEYS.zones, false),
    // Saved fiber is context by default — the whole point is seeing what is
    // already laid so a new line does not duplicate it.
    others: readPref(PREF_KEYS.others, true),
  }))
  const toggleOverlay = useCallback((key, value) => {
    writePref(PREF_KEYS[key], value)
    setOverlays((prev) => ({ ...prev, [key]: value }))
  }, [])
  return [overlays, toggleOverlay]
}

const centroid = (points) => ({
  lat: points.reduce((sum, p) => sum + p.latitude, 0) / points.length,
  lng: points.reduce((sum, p) => sum + p.longitude, 0) / points.length,
})

const mapsIcon = (icon) => ({
  url: icon.url,
  scaledSize: new google.maps.Size(icon.size, icon.size),
  anchor: new google.maps.Point(icon.anchor.x, icon.anchor.y),
})

/**
 * The editor's context overlays: POP/closure snap-target markers (always on —
 * you cannot snap to what you cannot see), lazily clustered building dots, and
 * lazily fetched zone outlines. Everything lives in refs; `onTargetClick` is
 * mirrored so a fresh arrow from the caller never rebuilds a layer.
 */
export function useEditorOverlays({ map, ready, targets, buildingsShown, zonesShown, onTargetClick }) {
  const clickRef = useRef(onTargetClick)
  useEffect(() => {
    clickRef.current = onTargetClick
  })

  // ---- POP + closure markers (always visible) -------------------------------
  useEffect(() => {
    if (!map || !ready) return
    const nodes = targets.filter((target) => target.kind === 'POP' || target.kind === 'CLOSURE')
    const markers = nodes.map((target) => {
      const kind = target.kind === 'CLOSURE' && target.splitter ? 'SPLITTER' : target.kind
      const marker = new google.maps.Marker({
        map,
        position: { lat: target.latitude, lng: target.longitude },
        icon: mapsIcon(typedMarkerIcon(kind)),
        zIndex: 8,
      })
      marker.addListener('click', () => clickRef.current?.(target))
      return marker
    })

    const applyZoom = () => {
      const zoom = map.getZoom() ?? 0
      const labelled = zoom >= LABEL_MIN_ZOOM
      markers.forEach((marker, i) => {
        marker.setLabel(labelled && nodes[i].label ? markerLabel(nodes[i].label) : null)
      })
    }
    applyZoom()
    const zoomListener = map.addListener('zoom_changed', applyZoom)

    return () => {
      google.maps.event.removeListener(zoomListener)
      markers.forEach((marker) => {
        google.maps.event.clearInstanceListeners(marker)
        marker.setMap(null)
      })
    }
  }, [map, ready, targets])

  // ---- building dots (lazy, clustered) -------------------------------------
  useEffect(() => {
    if (!map || !ready || !buildingsShown) return
    const markers = targets
      .filter((target) => target.kind === 'BUILDING')
      .map((target) => {
        const dot = buildingDotIcon(BUILDING_DOT_COLOR)
        const marker = new google.maps.Marker({
          position: { lat: target.latitude, lng: target.longitude },
          zIndex: 2,
          icon: {
            url: dot.url,
            scaledSize: new google.maps.Size(dot.size, dot.size),
            anchor: new google.maps.Point(dot.size / 2, dot.size / 2),
          },
        })
        marker.addListener('click', () => clickRef.current?.(target))
        return marker
      })
    const clusterer = new MarkerClusterer({ map, markers, renderer: clusterRenderer })

    return () => {
      clusterer.clearMarkers()
      // clearMarkers only empties the list — the clusterer is an OverlayView
      // holding an `idle` listener; only setMap(null) gives that back.
      clusterer.setMap(null)
      markers.forEach((marker) => {
        google.maps.event.clearInstanceListeners(marker)
        marker.setMap(null)
      })
    }
  }, [map, ready, targets, buildingsShown])

  // ---- zone outlines (lazy fetch, then lazy draw) ---------------------------
  const [zones, setZones] = useState(null)
  useEffect(() => {
    if (!zonesShown || zones) return
    let cancelled = false
    apiClient
      .get('/zones')
      .then((res) => {
        if (!cancelled) setZones(res.data.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [zonesShown, zones])

  useEffect(() => {
    if (!map || !ready || !zonesShown || !zones) return
    const overlays = zones
      .filter((zone) => zone.boundary?.length >= 3)
      .flatMap((zone, index) => {
        const color = zoneColor(index)
        return [
          new google.maps.Polygon({
            map,
            paths: zone.boundary.map((p) => ({ lat: p.latitude, lng: p.longitude })),
            strokeColor: color,
            strokeOpacity: 0.95,
            strokeWeight: 2.5,
            fillColor: color,
            fillOpacity: 0.15,
            clickable: false,
            zIndex: 1,
          }),
          new google.maps.Marker({
            map,
            position: centroid(zone.boundary),
            clickable: false,
            zIndex: 3,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              labelOrigin: new google.maps.Point(0, -2.4),
            },
            label: markerLabel(zone.name.toUpperCase()),
          }),
        ]
      })
    return () => overlays.forEach((overlay) => overlay.setMap(null))
  }, [map, ready, zonesShown, zones])
}
