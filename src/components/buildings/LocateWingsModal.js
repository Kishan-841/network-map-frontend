'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { buildingPinCached, DECLUTTER_MAP_STYLE } from '@/lib/map-markers'
import { invalidateBuildingMarkers } from '@/hooks/useBuildingMarkers'
import { nextWingName, wingFormErrors, wingSummary, wingTotals } from '@/lib/building-wings'
import { canManageBuildings } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import MapSearchBox from '@/components/map/MapSearchBox'
import { Button } from '@/components/ui/Button'
import { IconPlus } from '@/components/ui/icons'
import { WingCard } from './WingCard'

const LIVE = '#22c55e'
const OFF = '#ef4444'
const ALL_FIELDS = { name: true, homePass: true }

const wingIcon = (isLive, selected) => ({
  path: google.maps.SymbolPath.CIRCLE,
  scale: selected ? 16 : 12,
  fillColor: isLive ? LIVE : OFF,
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: selected ? 4 : 2,
})
const wingLabel = (name) => ({ text: (name || '?').slice(0, 3), color: '#fff', fontWeight: '700' })

/** What Save sends, and what "unsaved changes" compares (home pass as typed text). */
const payloadOf = (wings) =>
  wings.map(({ id, name, latitude, longitude, homePass, isLive }) => ({
    ...(id ? { id } : {}),
    name: String(name ?? '').trim(),
    latitude,
    longitude,
    homePass: String(homePass ?? '').trim(),
    isLive: Boolean(isLive),
  }))

const errorsOf = (wing, wings) =>
  wingFormErrors(wing, wings.filter((w) => w.key !== wing.key).map((w) => String(w.name).trim()))

/**
 * Full-screen editor for a building's wing pins: the map on the left (top on a
 * phone), the wings as editable cards on the right (below). "Add wing" arms the
 * map — the next tap drops a pin and opens its card. Mounted only while open, so
 * the Google map is created once per open and torn down on unmount. Save sends
 * the whole set.
 */
export function LocateWingsModal({ building, onClose, onSaved }) {
  const total = wingSummary(building).total
  // Only admins or managers mark live (mirrors LiveToggle); the API keeps a
  // surveyor's wings' Live as it was and starts their new wings not live.
  const canMarkLive = canManageBuildings(useAuthStore((st) => st.user?.role))
  const wasComplete = wingSummary(building).complete
  const initialWings = useMemo(() => (building.wings ?? []).map((w) => ({ ...w, key: w.id })), [building.wings])
  const [wings, setWings] = useState(initialWings)
  const [selectedKey, setSelectedKey] = useState(null)
  const [shown, setShown] = useState({}) // which of the selected card's fields show their error
  const [placing, setPlacing] = useState(false)
  const [focusKey, setFocusKey] = useState(null) // the card just dropped — focus its name
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const cardRefs = useRef(new Map())
  // Google listeners call through this ref so they always see the latest state.
  const handlers = useRef({})

  const dirty = JSON.stringify(payloadOf(wings)) !== JSON.stringify(payloadOf(initialWings))
  const completes = wings.length === total && total > 0 && !wasComplete
  const full = wings.length >= total
  const totals = wingTotals(wings)
  const selected = wings.find((w) => w.key === selectedKey) ?? null
  const selectedErrors = selected ? errorsOf(selected, wings) : {}
  const nextName = nextWingName(wings.map((w) => w.name))

  /** Move the selection; refused (and errors shown) while the open card is invalid. */
  function select(key) {
    if (key === selectedKey) return true
    if (selected && Object.keys(selectedErrors).length) {
      setShown(ALL_FIELDS)
      return false
    }
    setSelectedKey(key)
    setShown({})
    setFocusKey(null)
    return true
  }

  function armPlacing() {
    if (full) return
    if (!select(null)) return
    setPlacing(true)
  }

  function dropWing(latitude, longitude) {
    if (wings.length >= total || !select(null)) return setPlacing(false)
    const key = crypto.randomUUID()
    setWings((prev) => [
      ...prev,
      // A new wing starts with the building's own Live (not live for a surveyor).
      { key, name: nextName, homePass: '', isLive: canMarkLive && Boolean(building.isLive), latitude, longitude },
    ])
    setSelectedKey(key)
    setShown({})
    setFocusKey(key)
    setPlacing(false)
  }

  function updateWing(key, patch) {
    setWings((prev) => prev.map((w) => (w.key === key ? { ...w, ...patch } : w)))
  }

  function deleteWing(key) {
    setWings((prev) => prev.filter((w) => w.key !== key))
    if (key === selectedKey) {
      setSelectedKey(null)
      setShown({})
    }
  }

  useEffect(() => {
    handlers.current = {
      mapClick: (lat, lng) => placing && dropWing(lat, lng),
      pinSelect: (key) => select(key),
      pinMoved: (key, lat, lng) => updateWing(key, { latitude: lat, longitude: lng }),
    }
  })

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
        mapTypeControl: false,
        fullscreenControl: false,
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
      // Only an armed "Add wing" places a pin — a stray tap does nothing.
      clickListener = map.addListener('click', (e) => handlers.current.mapClick?.(e.latLng.lat(), e.latLng.lng()))
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
      const isSelected = w.key === selectedKey
      let marker = markers.get(w.key)
      if (!marker) {
        const key = w.key
        marker = new google.maps.Marker({ map: mapRef.current, position, draggable: true })
        marker.addListener('click', () => handlers.current.pinSelect?.(key))
        marker.addListener('dragstart', () => handlers.current.pinSelect?.(key))
        marker.addListener('dragend', () => {
          const p = marker.getPosition()
          handlers.current.pinMoved?.(key, p.lat(), p.lng())
        })
        markers.set(key, marker)
      } else {
        const p = marker.getPosition()
        if (p.lat() !== position.lat || p.lng() !== position.lng) marker.setPosition(position)
      }
      marker.setLabel(wingLabel(w.name))
      marker.setIcon(wingIcon(w.isLive, isSelected))
      marker.setZIndex(isSelected ? 30 : 10)
      marker.setTitle(w.name)
    }
    for (const [key, marker] of [...markers]) {
      if (key === '__building' || keep.has(key)) continue
      google.maps.event.clearInstanceListeners(marker)
      marker.setMap(null)
      markers.delete(key)
    }
  }, [wings, selectedKey, mapReady])

  // The selected wing: pan its pin into view if it's off-screen, and bring its card into view.
  useEffect(() => {
    if (!selectedKey) return
    const marker = markersRef.current.get(selectedKey)
    const map = mapRef.current
    const bounds = map?.getBounds()
    if (marker && bounds && !bounds.contains(marker.getPosition())) map.panTo(marker.getPosition())
    cardRefs.current.get(selectedKey)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedKey, mapReady])

  // Crosshair while placing; Esc cancels placement.
  useEffect(() => {
    if (!mapReady) return
    mapRef.current?.setOptions({ draggableCursor: placing ? 'crosshair' : null })
    if (!placing) return
    const onKey = (e) => e.key === 'Escape' && setPlacing(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [placing, mapReady])

  function cancel() {
    if (dirty && !window.confirm('Discard your wing changes?')) return
    onClose()
  }

  async function save() {
    const bad = wings.find((w) => Object.keys(errorsOf(w, wings)).length)
    if (bad) {
      setPlacing(false)
      setSelectedKey(bad.key)
      setShown(ALL_FIELDS)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await apiClient.put(`/buildings/${building.id}/wings`, {
        wings: payloadOf(wings).map((w) => ({ ...w, homePass: Number(w.homePass) })),
      })
      invalidateBuildingMarkers()
      onSaved(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the wings'))
      setSaving(false)
    }
  }

  let hint
  if (full) hint = 'Drag a pin to move it'
  else if (wings.length === 0) hint = 'Then tap the map where the wing is'
  else hint = `${total - wings.length} more to place`

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

      {error && <p className="mx-4 mt-3 rounded-btn bg-bad-tint px-4 py-2 text-sm text-bad" role="alert">{error}</p>}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[45%] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1">
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

        <aside className="flex min-h-0 flex-1 flex-col border-t border-line bg-card lg:w-[360px] lg:flex-none lg:border-l lg:border-t-0"
          aria-label="Wings">
          <div className="flex flex-col gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-ink">Wings</h3>
              <span className={`ml-auto text-right text-sm ${placing ? 'font-medium text-fiber' : 'text-muted'}`}>
                {placing ? `Tap the map where wing ${nextName} is` : hint}
              </span>
            </div>
            {placing ? (
              <Button variant="secondary" className="h-11 min-h-11" fullWidth onClick={() => setPlacing(false)}>
                Cancel adding
              </Button>
            ) : (
              <Button className="h-11 min-h-11" fullWidth disabled={full} onClick={armPlacing}>
                <IconPlus size={18} aria-hidden /> {full ? `All ${total} wings are placed` : `Add wing ${nextName}`}
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {wings.length === 0 ? (
              <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                No wings yet. Press <span className="font-semibold text-ink">Add wing</span>, then tap the map where
                the wing is. You can drag a pin to move it.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {wings.map((w) => {
                  const isSelected = w.key === selectedKey
                  return (
                    <WingCard
                      key={w.key}
                      wing={w}
                      expanded={isSelected}
                      errors={isSelected ? selectedErrors : errorsOf(w, wings)}
                      shown={isSelected ? shown : {}}
                      canMarkLive={canMarkLive}
                      autoFocus={w.key === focusKey}
                      cardRef={(el) => {
                        if (el) cardRefs.current.set(w.key, el)
                        else cardRefs.current.delete(w.key)
                      }}
                      onToggle={() => select(isSelected ? null : w.key)}
                      onChange={(patch) => updateWing(w.key, patch)}
                      onBlurField={(field) => setShown((s) => ({ ...s, [field]: true }))}
                      onDelete={() => deleteWing(w.key)}
                    />
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-line px-4 py-3 text-sm">
            {completes && (
              <p className="mb-1 text-fiber">All wings placed — home pass and Live will now come from the wings.</p>
            )}
            <p className="font-medium text-ink">
              Total {totals.homePass} HP · {totals.live} of {totals.placed} live
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
