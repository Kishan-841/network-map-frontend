'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { buildingPinCached, DECLUTTER_MAP_STYLE } from '@/lib/map-markers'
import { invalidateBuildingMarkers } from '@/hooks/useBuildingMarkers'
import { wingSummary } from '@/lib/building-wings'
import MapSearchBox from '@/components/map/MapSearchBox'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { WingForm } from './WingForm'

const LIVE = '#22c55e'
const OFF = '#ef4444'

const wingIcon = (isLive) => ({
  path: google.maps.SymbolPath.CIRCLE,
  scale: 11,
  fillColor: isLive ? LIVE : OFF,
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 2,
})
const wingLabel = (name) => ({ text: name, color: '#fff', fontWeight: '700' })

/**
 * Full-screen editor to drop, name, drag and delete a building's wing pins.
 * Mounted only while open, so the Google map is created once per open and torn
 * down (markers + listeners) on unmount. Save sends the whole set.
 */
export function LocateWingsModal({ building, onClose, onSaved }) {
  const total = wingSummary(building).total
  const wasComplete = wingSummary(building).complete
  const initialWings = useMemo(() => (building.wings ?? []).map((w) => ({ ...w, key: w.id })), [building.wings])
  const [wings, setWings] = useState(initialWings)
  const [sheet, setSheet] = useState(null) // { key?, latitude, longitude } — key set = editing
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const latest = useRef({ wings, total, sheetOpen: false })
  useEffect(() => {
    latest.current = { wings, total, sheetOpen: Boolean(sheet) }
  }, [wings, total, sheet])

  const dirty = JSON.stringify(wings) !== JSON.stringify(initialWings)
  const completes = wings.length === total && total > 0 && !wasComplete

  const openEdit = useCallback((key) => {
    const w = latest.current.wings.find((x) => x.key === key)
    if (w) setSheet({ key, latitude: w.latitude, longitude: w.longitude })
  }, [])

  // Create the map once; remove everything on close.
  useEffect(() => {
    let cancelled = false
    let clickListener = null
    const markers = markersRef.current
    const lat = Number(building.latitude)
    const lng = Number(building.longitude)
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || !containerRef.current) return
      const map = new Map(containerRef.current, {
        center: { lat, lng },
        zoom: 19,
        mapTypeId: 'hybrid',
        gestureHandling: 'greedy',
        clickableIcons: false,
        streetViewControl: false,
        styles: DECLUTTER_MAP_STYLE,
      })
      mapRef.current = map
      const pin = buildingPinCached({ color: '#64748b', shape: 'pin' })
      const ref = new google.maps.Marker({
        map,
        position: { lat, lng },
        clickable: false,
        draggable: false,
        title: building.buildingName,
        icon: {
          url: pin.url,
          scaledSize: new google.maps.Size(pin.width, pin.height),
          anchor: new google.maps.Point(pin.anchorX, pin.anchorY),
        },
      })
      markers.set('__building', ref)
      clickListener = map.addListener('click', (e) => {
        const { wings: current, total: max, sheetOpen } = latest.current
        if (sheetOpen) return
        if (current.length < max) {
          setSheet({ latitude: e.latLng.lat(), longitude: e.latLng.lng() })
        } else {
          setNotice(`All ${max} wings are placed — drag a pin or delete one`)
        }
      })
      setMapReady(true)
    })
    return () => {
      cancelled = true
      clickListener?.remove()
      for (const m of markers.values()) {
        google.maps.event.clearInstanceListeners(m)
        m.setMap(null)
      }
      markers.clear()
      mapRef.current = null
    }
  }, [building.latitude, building.longitude, building.buildingName])

  // Diff the wing markers against the draft: create / update / remove.
  useEffect(() => {
    if (!mapReady) return
    const markers = markersRef.current
    const keep = new Set()
    for (const w of wings) {
      keep.add(w.key)
      const position = { lat: Number(w.latitude), lng: Number(w.longitude) }
      let marker = markers.get(w.key)
      if (!marker) {
        marker = new google.maps.Marker({ map: mapRef.current, position, draggable: true, zIndex: 10 })
        marker.addListener('dragend', () => {
          const p = marker.getPosition()
          setWings((prev) => prev.map((x) => (x.key === w.key ? { ...x, latitude: p.lat(), longitude: p.lng() } : x)))
        })
        marker.addListener('click', () => openEdit(w.key))
        markers.set(w.key, marker)
      } else {
        marker.setPosition(position)
      }
      marker.setLabel(wingLabel(w.name))
      marker.setIcon(wingIcon(w.isLive))
      marker.setTitle(w.name)
    }
    for (const [key, marker] of [...markers]) {
      if (key === '__building' || keep.has(key)) continue
      google.maps.event.clearInstanceListeners(marker)
      marker.setMap(null)
      markers.delete(key)
    }
  }, [wings, mapReady, openEdit])

  const editing = sheet?.key ? wings.find((w) => w.key === sheet.key) : null
  const otherNames = wings.filter((w) => w.key !== sheet?.key).map((w) => w.name)

  function saveWing(values) {
    if (sheet.key) {
      setWings((prev) => prev.map((w) => (w.key === sheet.key ? { ...w, ...values } : w)))
    } else {
      setWings((prev) => [
        ...prev,
        { key: crypto.randomUUID(), latitude: sheet.latitude, longitude: sheet.longitude, ...values },
      ])
    }
    setSheet(null)
  }

  function deleteWing() {
    setWings((prev) => prev.filter((w) => w.key !== sheet.key))
    setSheet(null)
  }

  function cancel() {
    if (dirty && !window.confirm('Discard your wing changes?')) return
    onClose()
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await apiClient.put(`/buildings/${building.id}/wings`, {
        wings: wings.map(({ id, name, latitude, longitude, homePass, isLive }) => ({
          ...(id ? { id } : {}),
          name,
          latitude,
          longitude,
          homePass,
          isLive,
        })),
      })
      invalidateBuildingMarkers()
      onSaved(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the wings'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-card" role="dialog" aria-label="Locate wings">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-ink">{building.buildingName}</h2>
          <p className="text-sm text-muted">{wings.length} of {total} wings located</p>
        </div>
        <Button variant="secondary" className="h-10 min-h-10" disabled={saving} onClick={cancel}>Cancel</Button>
        <Button className="h-10 min-h-10" disabled={!dirty} loading={saving} onClick={save}>Save</Button>
      </header>

      {(completes || error || notice) && (
        <div className="flex flex-col gap-2 px-4 pt-3">
          {completes && (
            <p className="rounded-btn bg-fiber/10 px-4 py-2 text-sm text-fiber">
              Home pass and Live for this building will come from its wings.
            </p>
          )}
          {error && <p className="rounded-btn bg-bad-tint px-4 py-2 text-sm text-bad" role="alert">{error}</p>}
          <Toast key={notice} message={notice} tone="info" onDone={() => setNotice(null)} className="!mb-0" />
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full bg-paper" />
        {mapReady && (
          <div className="absolute left-3 right-3 top-3 max-w-md">
            <MapSearchBox
              buildings={[]}
              getCenter={() => {
                const c = mapRef.current?.getCenter()
                return c ? { latitude: c.lat(), longitude: c.lng() } : {}
              }}
              onPlace={(pin) => {
                mapRef.current?.panTo({ lat: pin.latitude, lng: pin.longitude })
                mapRef.current?.setZoom(19)
              }}
              onBuilding={() => {}}
              onClear={() => {}}
            />
          </div>
        )}
      </div>

      {wings.length > 0 && (
        <ul className="max-h-48 divide-y divide-line overflow-y-auto border-t border-line px-4 text-sm">
          {wings.map((w) => (
            <li key={w.key} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">{w.name}</span>
                <span className="text-muted"> · {w.homePass} home pass · </span>
                <span className={w.isLive ? 'text-ok' : 'text-bad'}>{w.isLive ? 'Live' : 'Not live'}</span>
              </span>
              <span className="flex shrink-0 gap-2">
                <button type="button" onClick={() => openEdit(w.key)}
                  className="h-9 rounded-btn border border-line px-3 text-sm font-medium text-ink hover:bg-paper">
                  Edit
                </button>
                <button type="button" onClick={() => setWings((prev) => prev.filter((x) => x.key !== w.key))}
                  aria-label={`Delete wing ${w.name}`}
                  className="h-9 rounded-btn border border-bad/40 px-3 text-sm font-medium text-bad hover:bg-bad-tint">
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {sheet && (
        <>
          <div className="fixed inset-0 z-[61] bg-black/30 lg:hidden" onClick={() => setSheet(null)} />
          <div className="fixed inset-x-0 bottom-0 z-[62] rounded-t-2xl bg-card p-4 shadow-soft lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-24 lg:w-80 lg:rounded-card lg:border lg:border-line">
            <h3 className="mb-3 text-sm font-bold text-ink">{editing ? `Edit wing ${editing.name}` : 'New wing'}</h3>
            <WingForm
              key={sheet.key ?? 'new'}
              initial={editing}
              otherNames={otherNames}
              onSave={saveWing}
              onCancel={() => setSheet(null)}
              onDelete={editing ? deleteWing : undefined}
            />
          </div>
        </>
      )}
    </div>
  )
}
