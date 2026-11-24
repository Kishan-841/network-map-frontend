'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'
import MapSearchButton from '@/components/map/MapSearchButton'

/**
 * Same contract as LeafletLocationPicker — draggable pin on Google Maps JS.
 * `searchable` adds a place search (top-left); picking a result moves the pin
 * there and reports it through `onChange`, exactly as a drag does.
 * `clickToPlace` also moves the pin to wherever the map is clicked; `marks`
 * ([{ latitude, longitude, label }]) are fixed reference dots (a building and
 * its wings) with their label as the hover title. `className` sizes the box.
 */
export default function GoogleLocationPicker({
  latitude,
  longitude,
  onChange,
  searchable = false,
  clickToPlace = false,
  marks = [],
  className = 'h-64',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [ready, setReady] = useState(false)
  // Default satellite so the pin lands on the building from imagery.
  const [layer, setLayer] = useMapLayer('picker', 'satellite')
  // dragend binds once — route the latest onChange through a ref to avoid a
  // stale closure reverting edited form fields.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || mapRef.current) return
      const map = new Map(containerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 18,
        mapTypeId: layer, // 'roadmap' | 'satellite' | 'hybrid'
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      })

      const marker = new google.maps.Marker({
        map,
        position: { lat: latitude, lng: longitude },
        draggable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#0e7569', // --color-fiber
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      })
      marker.addListener('dragend', () => {
        const point = marker.getPosition()
        onChangeRef.current({ latitude: point.lat(), longitude: point.lng() })
      })
      if (clickToPlace) {
        map.addListener('click', (e) => {
          marker.setPosition(e.latLng)
          onChangeRef.current({ latitude: e.latLng.lat(), longitude: e.latLng.lng() })
        })
      }

      mapRef.current = map
      markerRef.current = marker
      setReady(true)
    })
    return () => {
      cancelled = true
      markerRef.current?.setMap(null)
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ready && markerRef.current) {
      const position = { lat: latitude, lng: longitude }
      markerRef.current.setPosition(position)
      // Follow the pin when it leaves the view (coordinates typed by hand, a
      // search result) — but not after a drag, which by definition ends in view.
      const bounds = mapRef.current?.getBounds()
      if (bounds && !bounds.contains(position)) mapRef.current.panTo(position)
    }
  }, [latitude, longitude, ready])

  // Reference dots (the building and its wings). Keyed by content so a parent
  // re-render with an equal array does not redraw them.
  const marksKey = JSON.stringify(marks)
  useEffect(() => {
    if (!ready || !mapRef.current) return undefined
    const dots = JSON.parse(marksKey).map(
      (m) =>
        new google.maps.Marker({
          map: mapRef.current,
          position: { lat: m.latitude, lng: m.longitude },
          title: m.label,
          clickable: false,
          zIndex: 1,
          label: m.short ? { text: m.short, color: '#ffffff', fontSize: '10px', fontWeight: '600' } : undefined,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: m.short ? 9 : 6,
            fillColor: '#475569',
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        }),
    )
    return () => dots.forEach((d) => d.setMap(null))
  }, [marksKey, ready])

  // Apply layer changes to the live map.
  useEffect(() => {
    if (mapRef.current && ready) mapRef.current.setMapTypeId(layer)
  }, [layer, ready])

  return (
    <div className={`relative w-full overflow-hidden rounded-xl ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      <MapLayerControl value={layer} onChange={setLayer} />
      {searchable && ready && (
        <MapSearchButton
          align="left"
          compact
          getCenter={() => {
            const center = mapRef.current?.getCenter()
            return center ? { latitude: center.lat(), longitude: center.lng() } : {}
          }}
          onJump={({ latitude: lat, longitude: lng }) => {
            mapRef.current?.setCenter({ lat, lng })
            mapRef.current?.setZoom(18)
            onChangeRef.current({ latitude: lat, longitude: lng })
          }}
        />
      )}
    </div>
  )
}
