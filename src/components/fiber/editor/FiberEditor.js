'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { DECLUTTER_MAP_STYLE } from '@/lib/map-markers'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'
import { emptyDraft, reduce, draftErrors, fromApiPoints } from '@/lib/fiber/draft'
import { findSnap, targetToType, targetToRef } from '@/lib/fiber/snap'
import { haversineMeters } from '@/lib/fiber/geo'
import { useFibers } from '@/hooks/useFibers'
import { usePops } from '@/hooks/usePops'
import { useClosures } from '@/hooks/useClosures'
import { useFiberOverlays } from '../useFiberOverlays'
import { useDraftPolyline, pixelToLatLng, latLngToPixel } from './useDraftPolyline'
import { useSnapTargets } from './useSnapTargets'
import { usePointGesture } from './usePointGesture'
import { useEditorOverlays, useOverlayToggles } from './useEditorOverlays'
import PointMenu from './PointMenu'
import SplitterStartDialog from './SplitterStartDialog'
import SavePanel from './SavePanel'
import EditorSearch from './EditorSearch'
import EditorLegend from './EditorLegend'
import EditorHintBar from './EditorHintBar'
import EditorHeader from './EditorHeader'
import EditorToolbar from './EditorToolbar'
import TargetCard from './TargetCard'

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // country-level fallback
const DEFAULT_ZOOM = 5
const MAX_POINTS = 200 // matches the API cap (fiber.schemas.js)
const NEARBY_BUILDING_METERS = 50 // how far the point menu looks for a building
const OFF_SCREEN = { x: Infinity, y: Infinity }
const NO_FIBERS = [] // stable identity — useFiberOverlays rebuilds on a new array

// Ignore Google's own controls (zoom buttons, attribution links).
const isMapSurface = (event) => !event.target.closest('button, a, .gmnoprint, .gm-style-cc')

/**
 * Full-screen draw/edit surface for ONE fiber: a single chain of typed points
 * (POP / closure / building / waypoint) bound to one editable polyline. Taps in
 * Draw mode snap to nearby POPs, closures and buildings; a first tap on a
 * splitter closure asks which output the fiber leaves from. Save… hands the
 * draft to SavePanel, which writes it through `/fibers`.
 */
export default function FiberEditor({ initialFiber, onClose, onSaved }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  // The map instance lives in state as well as a ref: hooks take it as a prop
  // (a ref may not be read during render), the ref serves the DOM listeners.
  const [map, setMap] = useState(null)
  const ready = map !== null
  const [containerSize, setContainerSize] = useState(null)

  const [draft, dispatch] = useReducer(reduce, initialFiber, (fiber) =>
    fiber ? reduce(emptyDraft(), { type: 'load', points: fromApiPoints(fiber.points) }) : emptyDraft(),
  )
  const [drawing, setDrawing] = useState(false)
  const [coreCount, setCoreCount] = useState(initialFiber?.coreCount ?? 2)
  const [layer, setLayer] = useMapLayer('fiber', 'hybrid')
  const [overlays, toggleOverlay] = useOverlayToggles()
  // One-shot "ignore snapping": the ref is the authority the DOM handlers read,
  // the state only drives the hint bar.
  const [snapOff, setSnapOff] = useState(false)
  const snapOffRef = useRef(false)
  const [snapRing, setSnapRing] = useState(null)
  const ringIdRef = useRef(null) // last hovered target id — throttles setSnapRing
  const [fromSplitterOutput, setFromSplitterOutput] = useState(() =>
    initialFiber?.fedBy
      ? {
          splitterId: initialFiber.fedBy.splitter.id,
          portNo: initialFiber.fedBy.portNo,
          closureCode: initialFiber.fedBy.splitter.closure.code,
          closureId: initialFiber.fedBy.splitter.closure.id,
        }
      : null,
  )
  const [splitterDialog, setSplitterDialog] = useState(null) // the tapped closure target
  const [saveOpen, setSaveOpen] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState(null) // Pan-mode marker tap

  const { targets } = useSnapTargets({ enabled: true })
  const { pops } = usePops()
  const { closures } = useClosures()
  // Only fetched while the "Other fiber" overlay is on — the legend promises lazy.
  const { fibers } = useFibers(overlays.others)

  // Mirrors for the DOM listeners, which are attached once.
  const draftRef = useRef(draft)
  const drawingRef = useRef(drawing)
  const targetsRef = useRef(targets)
  useEffect(() => {
    draftRef.current = draft
    drawingRef.current = drawing
    targetsRef.current = targets
  })

  const applySnapOff = useCallback((value) => {
    snapOffRef.current = value
    setSnapOff(value)
  }, [])

  const { hitTest, projection } = useDraftPolyline({
    map,
    ready,
    draft,
    dispatch,
    drawing,
    coreCount,
    snapRing,
  })
  const { menu, close: closeMenu } = usePointGesture({ containerRef, enabled: ready, hitTest })

  const handleTargetClick = useCallback((target) => {
    if (!drawingRef.current) setSelectedTarget(target)
  }, [])
  useEditorOverlays({
    map,
    ready,
    targets,
    buildingsShown: overlays.buildings,
    zonesShown: overlays.zones,
    onTargetClick: handleTargetClick,
  })

  // Saved fibers as dim context behind the draft — never interactive here.
  // `fibers` is a fresh [] on every render until the fetch lands — map that
  // window onto the stable empty array so the overlay does not rebuild.
  const otherFibers = overlays.others && fibers.length > 0 ? fibers : NO_FIBERS
  useFiberOverlays({
    map,
    ready,
    fibers: otherFibers,
    exclude: initialFiber?.id,
    dim: true,
    cluster: false,
  })

  // ---- map boot -------------------------------------------------------------
  const initialLayerRef = useRef(layer)
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(({ Map }) => {
      if (cancelled || mapRef.current || !containerRef.current) return
      const map = new Map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: initialLayerRef.current,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        styles: DECLUTTER_MAP_STYLE,
      })
      mapRef.current = map
      const points = draftRef.current.points
      if (points.length > 0) {
        const bounds = new google.maps.LatLngBounds()
        points.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }))
        map.fitBounds(bounds, 64)
      }
      setMap(map)
    })
    return () => {
      cancelled = true
      mapRef.current = null
    }
  }, [])

  // The point menu clamps itself inside the map — it needs the live size.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setContainerSize((prev) =>
        prev?.width === width && prev?.height === height ? prev : { width, height },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (mapRef.current && ready) mapRef.current.setMapTypeId(layer)
  }, [layer, ready])

  // Draw mode: freeze pan/drag gestures (zoom buttons still work), crosshair.
  useEffect(() => {
    if (!mapRef.current || !ready) return
    mapRef.current.setOptions({
      gestureHandling: drawing ? 'none' : 'greedy',
      draggableCursor: drawing ? 'crosshair' : null,
    })
  }, [drawing, ready])

  // ---- draw gestures on the container (never the map's own click event) -----
  useEffect(() => {
    const container = containerRef.current
    if (!container || !ready) return

    const pixelOf = (event) => {
      const rect = container.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    const projectPixel = (target) =>
      latLngToPixel(projection.current, new google.maps.LatLng(target.latitude, target.longitude)) ??
      OFF_SCREEN
    const probe = (pixel) => {
      const latLng = pixelToLatLng(projection.current, pixel)
      if (!latLng) return { latLng: null, snap: null }
      const snap = findSnap(targetsRef.current, {
        pixel,
        latLng: { latitude: latLng.lat(), longitude: latLng.lng() },
        projectPixel,
      })
      return { latLng, snap }
    }
    const clearRing = () => {
      if (ringIdRef.current === null) return
      ringIdRef.current = null
      setSnapRing(null)
    }

    const onClick = (event) => {
      if (!drawingRef.current || !isMapSurface(event)) return
      if (draftRef.current.points.length >= MAX_POINTS) return
      const { latLng, snap: nearest } = probe(pixelOf(event))
      if (!latLng) return
      const snap = snapOffRef.current ? null : nearest
      if (snapOffRef.current) applySnapOff(false)
      // A fiber leaving a splitter must declare which output it leaves from.
      if (snap && draftRef.current.points.length === 0 && snap.kind === 'CLOSURE' && snap.splitter) {
        setSplitterDialog(snap)
        return
      }
      dispatch({
        type: 'add',
        point: snap
          ? {
              latitude: snap.latitude,
              longitude: snap.longitude,
              pointType: targetToType(snap),
              ref: targetToRef(snap),
            }
          : { latitude: latLng.lat(), longitude: latLng.lng() },
      })
    }

    const onMove = (event) => {
      if (!drawingRef.current || snapOffRef.current || !isMapSurface(event)) {
        clearRing()
        return
      }
      const { snap } = probe(pixelOf(event))
      const id = snap?.id ?? null
      if (id === ringIdRef.current) return
      ringIdRef.current = id
      setSnapRing(snap ? { latitude: snap.latitude, longitude: snap.longitude } : null)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && drawingRef.current) applySnapOff(true)
    }

    container.addEventListener('click', onClick)
    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseleave', clearRing)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('click', onClick)
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseleave', clearRing)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [ready, projection, applySnapOff])

  // ---- derived --------------------------------------------------------------
  const counts = useMemo(() => {
    const typed = draft.points.filter((p) => p.type !== 'WAYPOINT')
    return {
      points: draft.points.length,
      typed: typed.length,
      closures: typed.filter((p) => p.type === 'CLOSURE').length,
    }
  }, [draft.points])

  const errors = useMemo(
    () => draftErrors(draft.points, { fromSplitterOutput }),
    [draft.points, fromSplitterOutput],
  )

  const menuPoint = menu ? (draft.points.find((p) => p.key === menu.pointKey) ?? null) : null
  const nearbyBuildings = useMemo(() => {
    if (!menuPoint) return []
    return targets.filter(
      (t) => t.kind === 'BUILDING' && haversineMeters(menuPoint, t) <= NEARBY_BUILDING_METERS,
    )
  }, [menuPoint, targets])

  // The feed can only be dropped while nothing in the draft depends on it.
  const canClearFeed =
    draft.points.length === 0 || draft.points[0].ref?.closureId !== fromSplitterOutput?.closureId

  // ---- actions --------------------------------------------------------------
  // An empty draft has nothing left that the feed describes, so drop it with
  // the points rather than leaving a chip pointing at a closure nobody drew.
  function emptyDraftDropsFeed(remaining) {
    if (remaining === 0) setFromSplitterOutput(null)
  }

  function handleUndo() {
    dispatch({ type: 'undo' })
    emptyDraftDropsFeed(draft.points.length - 1)
  }

  function handleClear() {
    dispatch({ type: 'clear' })
    emptyDraftDropsFeed(0)
  }

  function pickSplitterOutput({ splitterId, portNo }) {
    const target = splitterDialog
    setFromSplitterOutput({
      splitterId,
      portNo,
      closureCode: target.label,
      closureId: target.id,
    })
    dispatch({
      type: 'add',
      point: {
        latitude: target.latitude,
        longitude: target.longitude,
        pointType: targetToType(target),
        ref: targetToRef(target),
      },
    })
    setSplitterDialog(null)
  }

  function jumpTo({ latitude, longitude }) {
    mapRef.current?.panTo({ lat: latitude, lng: longitude })
    mapRef.current?.setZoom(15)
  }

  const getCenter = useCallback(() => {
    const center = mapRef.current?.getCenter()
    return { latitude: center?.lat() ?? DEFAULT_CENTER.lat, longitude: center?.lng() ?? DEFAULT_CENTER.lng }
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
      {/* Dark halo keeps map labels readable on roadmap AND imagery. */}
      <style>{`.fiber-zone-label { text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.75); }`}</style>

      <EditorHeader
        title={initialFiber?.name?.trim() || 'New fiber'}
        counts={counts}
        canSave={errors.length === 0}
        onUndo={handleUndo}
        onClear={handleClear}
        onCancel={onClose}
        onSave={() => setSaveOpen(true)}
        hint={counts.points < 2 ? 'Draw at least two points' : null}
      />

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />

        <EditorSearch getCenter={getCenter} onJump={jumpTo} />

        <EditorToolbar
          drawing={drawing}
          onDrawing={(next) => {
            setDrawing(next)
            if (next) setSelectedTarget(null) // a stale card is noise while drawing
          }}
          coreCount={coreCount}
          onCoreCount={setCoreCount}
          fromSplitterOutput={fromSplitterOutput}
          canClearFeed={canClearFeed}
          onClearFeed={() => setFromSplitterOutput(null)}
        />

        <EditorLegend
          value={overlays}
          onToggle={(key, value) => {
            toggleOverlay(key, value)
            if (key === 'buildings' && !value) setSelectedTarget(null)
          }}
          onClear={handleClear}
          canClear={counts.points > 0}
        />

        <MapLayerControl value={layer} onChange={setLayer} position="right-3 top-[4.25rem] sm:top-3" />

        <EditorHintBar
          drawing={drawing}
          snapOff={snapOff}
          onToggleSnapOff={() => applySnapOff(!snapOff)}
        />

        {/* Under two points the only error is the length rule, which the header's
            helper line already states — keep the banner for the real ones. */}
        {counts.points >= 2 && errors.length > 0 && (
          <div className="absolute left-3 right-3 top-[13rem] z-10 mx-auto max-w-md rounded-card border border-line bg-card px-4 py-3 text-sm font-normal text-bad shadow-lift sm:top-[9.5rem]">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}

        {/* Tapped POP / closure / building (Pan mode): compact details card. */}
        {selectedTarget && (
          <TargetCard target={selectedTarget} onClose={() => setSelectedTarget(null)} />
        )}

        {menu && menuPoint && (
          <PointMenu
            point={menuPoint}
            at={{ x: menu.x, y: menu.y }}
            bounds={containerSize}
            pops={pops}
            nearbyBuildings={nearbyBuildings}
            onChoose={(pointType, ref, position) =>
              dispatch({
                type: 'setType',
                key: menu.pointKey,
                pointType,
                ref,
                ...(position ?? {}),
              })
            }
            onRemove={() => dispatch({ type: 'remove', key: menu.pointKey })}
            onClose={closeMenu}
          />
        )}

        {splitterDialog && (
          <SplitterStartDialog
            closure={{ id: splitterDialog.id, code: splitterDialog.label }}
            splitters={closures.find((c) => c.id === splitterDialog.id)?.splitters ?? []}
            onPick={pickSplitterOutput}
            onClose={() => setSplitterDialog(null)}
          />
        )}

        {/* Mounted fresh each time so its laid-metres state re-initialises. */}
        {saveOpen && (
          <SavePanel
            mode={initialFiber ? 'edit' : 'create'}
            fiber={initialFiber}
            draftPoints={draft.points}
            coreCount={coreCount}
            fromSplitterOutput={fromSplitterOutput}
            onSaved={(fiber) => {
              onSaved?.(fiber)
            }}
            onBack={() => setSaveOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
