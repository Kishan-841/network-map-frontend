'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { apiClient } from '@/lib/api-client'
import { zoneColor } from '@/lib/constants'
import { buildingDotIcon, clusterRenderer } from '@/lib/map-markers'
import { typedMarkerIcon, markerLabel, labelBadgeIcon } from '@/lib/fiber/markers'

// Badges carry their own background, so a POP / closure name reads earlier than
// a bare label did; below this, hovering a (clickable) symbol still shows one.
const BADGE_MIN_ZOOM = 15
// Building names are clutter until you are right in on one street — and there
// can be thousands, so their badges are only built once this zoom is reached.
const BUILDING_BADGE_MIN_ZOOM = 17
const NO_IDS = new Set() // stable identity for the default `excludeIds`
// useSnapTargets carries no live flag, so building dots stay neutral here —
// colour would imply a status the editor cannot know.
const BUILDING_DOT_COLOR = '#64748b'

const PREF_KEYS = {
  buildings: 'fiber-buildings-shown',
  zones: 'fiber-zones-shown',
  others: 'fiber-others-shown',
  pops: 'fiber-pops-shown',
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

/** Remembered Buildings / Zones / POPs / Other-fiber toggles. */
export function useOverlayToggles() {
  const [overlays, setOverlays] = useState(() => ({
    buildings: readPref(PREF_KEYS.buildings, false),
    zones: readPref(PREF_KEYS.zones, false),
    // Saved fiber is context by default — the whole point is seeing what is
    // already there so a new line does not duplicate it.
    others: readPref(PREF_KEYS.others, true),
    // POPs are where the network starts — worth seeing while you draw towards
    // one, so they are on unless the reader turns them off.
    pops: readPref(PREF_KEYS.pops, true),
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

// Takes both icon shapes: a square symbol (`size`) and a badge (`width`/`height`).
const mapsIcon = (icon) => ({
  url: icon.url,
  scaledSize: new google.maps.Size(icon.width ?? icon.size, icon.height ?? icon.size),
  anchor: new google.maps.Point(icon.anchor.x, icon.anchor.y),
})

/** A closure carrying a splitter reads as code AND ratio, as on the map page. */
const badgeText = (target) => {
  if (!target.label) return ''
  return target.splitter ? `${target.label} · ${target.splitter}` : target.label
}

/**
 * The badge floating above a POP/closure node — built the first time it is
 * needed (in view and zoomed in, or hovered), not up front: there can be well
 * over a thousand closures and most are never on screen.
 */
function nodeBadge(map, entry) {
  if (entry.badge !== undefined) return entry.badge
  const text = badgeText(entry.target)
  if (!text) {
    entry.badge = null
    return null
  }
  entry.icons = { light: labelBadgeIcon(text), dark: labelBadgeIcon(text, { tone: 'dark' }) }
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

/** Whether `marker` sits inside the map's current view. */
const inView = (map, marker) => Boolean(map.getBounds()?.contains(marker.getPosition()))

function removeNode(entry) {
  google.maps.event.clearInstanceListeners(entry.marker)
  entry.marker.setMap(null)
  entry.badge?.setMap(null)
}

/**
 * The editor's context overlays: POP/closure snap-target markers (always on —
 * you cannot snap to what you cannot see), lazily clustered building dots, and
 * lazily fetched zone outlines. Everything lives in refs; `onTargetClick` is
 * mirrored so a fresh arrow from the caller never rebuilds a layer.
 */
export function useEditorOverlays({
  map,
  ready,
  nodeTargets,
  buildingTargets,
  buildingsShown,
  zonesShown,
  onTargetClick,
  markersClickable = true,
  // Closures/splitters the DRAFT already draws: the editor would otherwise
  // paint them twice (draft layer + context layer) with two colliding badges.
  excludeIds = NO_IDS,
}) {
  const clickRef = useRef(onTargetClick)
  useEffect(() => {
    clickRef.current = onTargetClick
  })

  // A clickable Google marker eats the tap on a touch screen: the browser never
  // synthesises the click the draw handler listens for, so tapping a POP or a
  // splitter diamond to start a line did nothing on a phone. Draw mode has no
  // use for marker clicks (the target card is Pan-mode only), so the markers
  // step out of the way there and the tap reaches the map surface.
  const clickableRef = useRef(markersClickable)
  const nodeMarkersRef = useRef([])
  const buildingMarkersRef = useRef([])
  // Declared BEFORE the layers so the ref is current when they (re)build.
  useEffect(() => {
    clickableRef.current = markersClickable
    for (const marker of [...nodeMarkersRef.current, ...buildingMarkersRef.current]) {
      marker.setOptions({ clickable: markersClickable })
    }
  }, [markersClickable])

  // ---- POP + closure markers (always visible) -------------------------------
  // Excluding by a SORTED JOINED KEY, not by the Set's identity: the draft
  // rebuilds that Set on every point move, and the context layer must only
  // change when its membership actually changed.
  const excludeKey = useMemo(() => [...excludeIds].sort().join('|'), [excludeIds])
  const nodes = useMemo(() => {
    const skip = new Set(excludeKey ? excludeKey.split('|') : [])
    // POPs stay whatever the draft does — they are landmarks, not annotations.
    return nodeTargets.filter(
      (target) => target.kind === 'POP' || (target.kind === 'CLOSURE' && !skip.has(target.id)),
    )
  }, [nodeTargets, excludeKey])

  // Kept by id and updated in place: every save refetches all closures, and
  // tearing down + recreating every marker (there can be well over a thousand)
  // for one changed closure froze slow phones. id → { target, kind, marker, badge }
  const nodeEntriesRef = useRef(new Map())
  const nodeMapRef = useRef(null)
  const applyNodeBadgesRef = useRef(() => {})

  useEffect(() => {
    if (!map || !ready) return
    const entries = nodeEntriesRef.current
    if (nodeMapRef.current !== map) {
      for (const entry of entries.values()) removeNode(entry)
      entries.clear()
      nodeMapRef.current = map
    }

    const badgeShown = (entry) => (map.getZoom() ?? 0) >= BADGE_MIN_ZOOM && inView(map, entry.marker)
    const applyNodeBadges = () => {
      for (const entry of entries.values()) {
        if (entry.hovered) continue
        if (badgeShown(entry)) nodeBadge(map, entry)?.setVisible(true)
        else entry.badge?.setVisible(false)
      }
    }
    applyNodeBadgesRef.current = applyNodeBadges

    const next = new Set(nodes.map((target) => target.id))
    for (const [id, entry] of entries) {
      if (!next.has(id)) {
        removeNode(entry)
        entries.delete(id)
      }
    }
    for (const target of nodes) {
      const kind = target.kind === 'CLOSURE' && target.splitter ? 'SPLITTER' : target.kind
      const position = { lat: target.latitude, lng: target.longitude }
      const entry = entries.get(target.id)
      if (!entry) {
        const created = {
          target,
          kind,
          marker: new google.maps.Marker({
            map,
            position,
            icon: mapsIcon(typedMarkerIcon(kind)),
            clickable: clickableRef.current,
            zIndex: 8,
          }),
          badge: undefined, // built on first need
        }
        created.marker.addListener('click', () => clickRef.current?.(created.target))
        // Hover only reaches a CLICKABLE marker — in Draw / Add-closure the
        // symbols step out of the way, and there the badge never lights up.
        created.marker.addListener('mouseover', () => {
          created.hovered = true
          const badge = nodeBadge(map, created)
          badge?.setIcon(mapsIcon(created.icons.dark))
          badge?.setVisible(true)
        })
        created.marker.addListener('mouseout', () => {
          created.hovered = false
          created.badge?.setIcon(mapsIcon(created.icons.light))
          created.badge?.setVisible(badgeShown(created))
        })
        entries.set(target.id, created)
        continue
      }
      if (entry.target.latitude !== target.latitude || entry.target.longitude !== target.longitude) {
        entry.marker.setPosition(position)
        entry.badge?.setPosition(position)
      }
      if (entry.kind !== kind) entry.marker.setIcon(mapsIcon(typedMarkerIcon(kind)))
      if (badgeText(entry.target) !== badgeText(target) && entry.badge !== undefined) {
        // The name changed: drop the old badge; it is rebuilt on next need.
        entry.badge?.setMap(null)
        entry.badge = undefined
      }
      entry.target = target
      entry.kind = kind
    }
    nodeMarkersRef.current = [...entries.values()].map((entry) => entry.marker)
    applyNodeBadges()
  }, [map, ready, nodes])

  // Badges follow the view: shown on zoom-in for what is on screen.
  useEffect(() => {
    if (!map || !ready) return
    const run = () => applyNodeBadgesRef.current()
    const zoomListener = map.addListener('zoom_changed', run)
    const idleListener = map.addListener('idle', run)
    return () => {
      google.maps.event.removeListener(zoomListener)
      google.maps.event.removeListener(idleListener)
    }
  }, [map, ready])

  // Everything goes when the editor closes.
  useEffect(
    () => () => {
      for (const entry of nodeEntriesRef.current.values()) removeNode(entry)
      nodeEntriesRef.current.clear()
      nodeMapRef.current = null
      nodeMarkersRef.current = []
    },
    [],
  )

  // ---- building dots (lazy, clustered) -------------------------------------
  useEffect(() => {
    if (!map || !ready || !buildingsShown) return
    const buildings = buildingTargets
    const markers = buildings.map((target) => {
      const dot = buildingDotIcon(BUILDING_DOT_COLOR)
      const marker = new google.maps.Marker({
        position: { lat: target.latitude, lng: target.longitude },
        clickable: clickableRef.current,
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
    buildingMarkersRef.current = markers
    const clusterer = new MarkerClusterer({ map, markers, renderer: clusterRenderer })

    // Building names: there can be thousands, so a badge is only BUILT the
    // first time its building is on screen with the map zoomed right in — and
    // each is only shown while the clusterer has not swallowed its dot.
    const badges = new Map() // index → badge
    const applyZoom = () => {
      if ((map.getZoom() ?? 0) < BUILDING_BADGE_MIN_ZOOM) {
        badges.forEach((badge) => badge.setVisible(false))
        return
      }
      buildings.forEach((target, i) => {
        if (!target.label) return
        const show = Boolean(markers[i].getMap()) && inView(map, markers[i])
        let badge = badges.get(i)
        if (show && !badge) {
          badge = new google.maps.Marker({
            map,
            position: { lat: target.latitude, lng: target.longitude },
            clickable: false,
            visible: false,
            zIndex: 3,
            icon: mapsIcon(labelBadgeIcon(target.label)),
          })
          badges.set(i, badge)
        }
        badge?.setVisible(show)
      })
    }
    applyZoom()
    // `idle` as well as `zoom_changed`: the clusterer re-splits its markers on
    // idle, so which dots are actually drawn is only settled by then.
    const zoomListener = map.addListener('zoom_changed', applyZoom)
    const idleListener = map.addListener('idle', applyZoom)

    return () => {
      google.maps.event.removeListener(zoomListener)
      google.maps.event.removeListener(idleListener)
      badges.forEach((badge) => badge.setMap(null))
      buildingMarkersRef.current = []
      clusterer.clearMarkers()
      // clearMarkers only empties the list — the clusterer is an OverlayView
      // holding an `idle` listener; only setMap(null) gives that back.
      clusterer.setMap(null)
      markers.forEach((marker) => {
        google.maps.event.clearInstanceListeners(marker)
        marker.setMap(null)
      })
    }
  }, [map, ready, buildingTargets, buildingsShown])

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
