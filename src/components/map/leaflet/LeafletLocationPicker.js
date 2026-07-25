'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:20px;height:20px;border-radius:9999px;background:#2563eb;border:4px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

export default function LocationPicker({ latitude, longitude, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (mapRef.current) return

    const map = L.map(containerRef.current).setView([latitude, longitude], 18)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([latitude, longitude], { draggable: true, icon: markerIcon }).addTo(map)
    marker.on('dragend', () => {
      const point = marker.getLatLng()
      onChange({ latitude: point.lat, longitude: point.lng })
    })

    mapRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (markerRef.current) markerRef.current.setLatLng([latitude, longitude])
  }, [latitude, longitude])

  return <div ref={containerRef} className="h-64 w-full rounded-xl" />
}
