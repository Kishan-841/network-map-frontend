'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import { DECLUTTER_MAP_STYLE } from '@/lib/map-markers'
import { useMapLayer } from '@/lib/useMapLayer'
import { MapLayerControl } from '@/components/map/MapLayerControl'
import { emptyDraft, reduce, draftErrors, fromApiPoints, toPayloadPoints } from '@/lib/fiber/draft'
import { useFibers, invalidateFibers } from '@/hooks/useFibers'
import { invalidateClosures } from '@/hooks/useClosures'
import { useFiberOverlays } from '../useFiberOverlays'
import { useDraftPolyline, pixelToLatLng } from './useDraftPolyline'
import { useSnapTargets } from './useSnapTargets'
import { useEditorOverlays, useOverlayToggles } from './useEditorOverlays'
import SavePanel from './SavePanel'
import ClosureCard from './ClosureCard'
import EditorSearch from './EditorSearch'
import EditorLegend from './EditorLegend'
import EditorHintBar from './EditorHintBar'
import EditorHeader from './EditorHeader'
import EditorToolbar from './EditorToolbar'
import TargetCard from './TargetCard'

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 } // country-level fallback
const DEFAULT_ZOOM = 5
const MAX_POINTS = 200 // matches the API cap (fiber.schemas.js)
const MISS_HINT_MS = 1600
const NO_FIBERS = [] // stable identity — useFiberOverlays rebuilds on a new array

// Ignore Google's own controls (zoom buttons, attribution links).
const isMapSurface = (event) => !event.target.closest('button, a, .gmnoprint, .gm-style-cc')

// What "the same line" means for the dirty check: order, type, position and
// which entity each point points at. Fixed precision because a LatLng
// round-trip through the API is decimal, not bit-identical.
const signatureOf = (points) =>
  points
    .map(
      (p) =>
        `${p.type}:${p.latitude.toFixed(7)},${p.longitude.toFixed(7)}:${
          p.ref?.closureId ?? p.ref?.popId ?? p.ref?.buildingId ?? (p.ref?.newClosure ? 'new' : '')
        }`,
    )
    .join('|')

const HINTS = {
  pan: 'Navigate to the area, then switch to Draw points',
  draw: 'Tap to add a point · drag a point to move it',
  annotatePan: 'Add closure: click the line where the closure sits',
  addClosure: 'Click on the line to place a closure',
  editLine: 'Tap to extend the line · Save changes when done',
}

/**
 * Full-screen editor for ONE fiber, in two phases on the same map:
 *
 *  - `draw`     — a new line: tap points, then "Save fiber" writes it with the
 *                 short details form. The editor stays open.
 *  - `annotate` — a saved fiber: click the line to drop a closure on it (the
 *                 API mints its CL- code), edit the line, or close with Done.
 *
 * Editing an existing fiber lands straight in `annotate`.
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
  const [fiber, setFiber] = useState(initialFiber ?? null)
  const phase = fiber ? 'annotate' : 'draw'
  const [mode, setMode] = useState(initialFiber ? 'pan' : 'draw')
  const [savedSignature, setSavedSignature] = useState(() =>
    initialFiber ? signatureOf(fromApiPoints(initialFiber.points)) : null,
  )
  const [coreCount, setCoreCount] = useState(initialFiber?.coreCount ?? 2)
  const [layer, setLayer] = useMapLayer('fiber', 'hybrid')
  const [overlays, toggleOverlay] = useOverlayToggles()
  const [saveOpen, setSaveOpen] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState(null) // Pan-mode marker tap
  const [closureCard, setClosureCard] = useState(null) // { key, x, y }
  const [closureSaving, setClosureSaving] = useState(false)
  const [closureError, setClosureError] = useState(null)
  const [pointsError, setPointsError] = useState(null)
  const [savingPoints, setSavingPoints] = useState(false)
  const [missAt, setMissAt] = useState(0) // a click that found no line

  // Draw and Add-closure both take over the tap: the map's own gestures go
  // quiet so every tap reaches our handler.
  const drawing = mode === 'draw' || mode === 'editLine'
  const frozen = drawing || mode === 'addClosure'

  const { targets } = useSnapTargets({ enabled: true })
  // Only fetched while the "Other fiber" overlay is on — the legend promises lazy.
  const { fibers } = useFibers(overlays.others)

  // Mirrors for the DOM listeners, which are attached once.
  const draftRef = useRef(draft)
  const modeRef = useRef(mode)
  const cardOpenRef = useRef(false)
  useEffect(() => {
    draftRef.current = draft
    modeRef.current = mode
    cardOpenRef.current = closureCard !== null
  })

  const { hitTestLine, projection } = useDraftPolyline({
    map,
    ready,
    draft,
    dispatch,
    drawing,
    coreCount,
    snapRing: null,
  })

  const handleTargetClick = useCallback((target) => {
    if (modeRef.current === 'pan') setSelectedTarget(target)
  }, [])
  useEditorOverlays({
    map,
    ready,
    targets,
    buildingsShown: overlays.buildings,
    zonesShown: overlays.zones,
    onTargetClick: handleTargetClick,
    // Drawing / dropping a closure: markers must not intercept the tap.
    markersClickable: !frozen,
  })

  // Saved fibers as dim context behind the draft — never interactive here.
  // `fibers` is a fresh [] on every render until the fetch lands — map that
  // window onto the stable empty array so the overlay does not rebuild.
  const otherFibers = overlays.others && fibers.length > 0 ? fibers : NO_FIBERS
  useFiberOverlays({
    map,
    ready,
    fibers: otherFibers,
    exclude: fiber?.id,
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

  // The closure card clamps itself inside the map — it needs the live size.
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

  // Draw / Add closure: freeze pan-drag gestures (zoom buttons still work).
  useEffect(() => {
    if (!mapRef.current || !ready) return
    mapRef.current.setOptions({
      gestureHandling: frozen ? 'none' : 'greedy',
      draggableCursor: frozen ? 'crosshair' : null,
    })
  }, [frozen, ready])

  // "Click on the line" nudge fades on its own.
  useEffect(() => {
    if (!missAt) return
    const timer = setTimeout(() => setMissAt(0), MISS_HINT_MS)
    return () => clearTimeout(timer)
  }, [missAt])

  // ---- map taps on the container (never the map's own click event) ----------
  useEffect(() => {
    const container = containerRef.current
    if (!container || !ready) return

    const onClick = (event) => {
      if (cardOpenRef.current || !isMapSurface(event)) return
      const rect = container.getBoundingClientRect()
      const pixel = { x: event.clientX - rect.left, y: event.clientY - rect.top }

      if (modeRef.current === 'addClosure') {
        const hit = hitTestLine(pixel)
        if (!hit) {
          setMissAt(Date.now())
          return
        }
        const key = `p${draftRef.current.nextKey}`
        dispatch({
          type: 'insert',
          index: hit.index + 1,
          point: {
            latitude: hit.latitude,
            longitude: hit.longitude,
            pointType: 'CLOSURE',
            ref: { newClosure: { kind: null } },
          },
        })
        setClosureError(null)
        setClosureCard({ key, x: pixel.x, y: pixel.y })
        return
      }

      if (modeRef.current !== 'draw' && modeRef.current !== 'editLine') return
      if (draftRef.current.points.length >= MAX_POINTS) return
      const latLng = pixelToLatLng(projection.current, pixel)
      if (!latLng) return
      dispatch({ type: 'add', point: { latitude: latLng.lat(), longitude: latLng.lng() } })
    }

    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [ready, projection, hitTestLine])

  // ---- derived --------------------------------------------------------------
  const counts = useMemo(
    () => ({
      points: draft.points.length,
      closures: draft.points.filter((p) => p.type === 'CLOSURE').length,
    }),
    [draft.points],
  )

  // A fiber fed by a splitter legitimately starts on that splitter closure —
  // the editor no longer offers the feed, but it must not fail its own rule.
  const feedClosureId = fiber?.fedBy?.splitter?.closure?.id ?? null
  const errors = useMemo(
    () =>
      draftErrors(draft.points, {
        fromSplitterOutput: feedClosureId ? { closureId: feedClosureId } : null,
      }),
    [draft.points, feedClosureId],
  )

  const dirty = phase === 'annotate' && signatureOf(draft.points) !== savedSignature

  const hint = missAt
    ? 'Click on the line'
    : phase === 'draw'
      ? HINTS[mode]
      : mode === 'pan'
        ? HINTS.annotatePan
        : HINTS[mode]

  // ---- actions --------------------------------------------------------------
  function applySaved(saved) {
    const points = fromApiPoints(saved.points)
    setFiber(saved)
    dispatch({ type: 'load', points })
    setSavedSignature(signatureOf(points))
    invalidateFibers()
    invalidateClosures()
    onSaved?.(saved)
  }

  function handleCreated(saved) {
    setSaveOpen(false)
    setMode('pan')
    applySaved(saved)
  }

  // A details-only save must not touch the draft: line edits in progress are
  // the editor's own, and "Save changes" is what writes them.
  function handleDetailsSaved(saved) {
    setSaveOpen(false)
    setFiber(saved)
    invalidateFibers()
    onSaved?.(saved)
  }

  async function patchPoints(points) {
    const res = await apiClient.patch(`/fibers/${fiber.id}`, { points: toPayloadPoints(points) })
    applySaved(res.data.data)
  }

  async function handleSaveChanges() {
    setSavingPoints(true)
    setPointsError(null)
    try {
      await patchPoints(draft.points)
    } catch (err) {
      setPointsError(getApiErrorMessage(err))
    } finally {
      setSavingPoints(false)
    }
  }

  async function handleClosureSave({ kind, notes }) {
    const { key } = closureCard
    const ref = { newClosure: { kind, notes } }
    // The reducer's update lands next render — PATCH the list we just built.
    const points = draft.points.map((p) => (p.key === key ? { ...p, type: 'CLOSURE', ref } : p))
    dispatch({ type: 'setType', key, pointType: 'CLOSURE', ref })
    setClosureSaving(true)
    setClosureError(null)
    try {
      await patchPoints(points)
      setClosureCard(null)
    } catch (err) {
      setClosureError(getApiErrorMessage(err))
    } finally {
      setClosureSaving(false)
    }
  }

  function handleClosureCancel() {
    dispatch({ type: 'remove', key: closureCard.key })
    setClosureCard(null)
    setClosureError(null)
  }

  function handleDone() {
    if (dirty && !window.confirm('The line has unsaved changes. Close anyway?')) return
    onClose()
  }

  function handleMode(next) {
    setMode(next)
    if (next !== 'pan') setSelectedTarget(null) // a stale card is noise while drawing
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
        title={fiber?.name?.trim() || 'New fiber'}
        counts={counts}
        phase={phase}
        canSave={errors.length === 0}
        dirty={dirty}
        savingPoints={savingPoints}
        drawingLine={mode === 'editLine'}
        onUndo={() => dispatch({ type: 'undo' })}
        onClear={() => dispatch({ type: 'clear' })}
        onCancel={onClose}
        onSave={() => setSaveOpen(true)}
        onDetails={() => setSaveOpen(true)}
        onSaveChanges={handleSaveChanges}
        onDone={handleDone}
        hint={phase === 'draw' && counts.points < 2 ? 'Draw at least two points' : null}
      />

      <div className="relative min-h-0 flex-1">
        {/* touch-action while a mode owns the tap: with the default `auto`, the
            browser holds a tap back to see whether a double-tap-to-zoom is
            coming and never synthesises the click at all — on a phone the
            first tap is lost and every later one lands a point behind. Those
            modes already turn the map's own gestures off, so taking the
            browser's away with them costs nothing. */}
        <div
          ref={containerRef}
          className="h-full w-full"
          style={frozen ? { touchAction: 'none' } : undefined}
        />

        <EditorSearch getCenter={getCenter} onJump={jumpTo} />

        <EditorToolbar
          phase={phase}
          mode={mode}
          onMode={handleMode}
          coreCount={coreCount}
          onCoreCount={setCoreCount}
          showCores={phase === 'draw' || mode === 'editLine'}
        />

        <EditorLegend
          value={overlays}
          onToggle={(key, value) => {
            toggleOverlay(key, value)
            if (key === 'buildings' && !value) setSelectedTarget(null)
          }}
          onClear={() => dispatch({ type: 'clear' })}
          canClear={phase === 'draw' && counts.points > 0}
        />

        {/* A phone's top rows belong to the search and the mode control — the
            layer switcher sits out of the way, above the zoom buttons. */}
        <MapLayerControl
          value={layer}
          onChange={setLayer}
          position="right-3 bottom-[8.5rem] sm:bottom-auto sm:top-3"
        />

        <EditorHintBar hint={hint} tone={missAt ? 'warn' : 'muted'} />

        {/* Under two points the only error is the length rule, which the header's
            helper line already states — keep the banner for the real ones. */}
        {((counts.points >= 2 && errors.length > 0) || pointsError) && (
          <div className="absolute left-3 right-3 top-[13rem] z-10 mx-auto max-w-md rounded-card border border-line bg-card px-4 py-3 text-sm font-normal text-bad shadow-lift sm:top-[9.5rem]">
            {counts.points >= 2 && errors.map((error) => <p key={error}>{error}</p>)}
            {pointsError && <p>{pointsError}</p>}
          </div>
        )}

        {/* Tapped POP / closure / building (Pan mode): compact details card. */}
        {selectedTarget && (
          <TargetCard target={selectedTarget} onClose={() => setSelectedTarget(null)} />
        )}

        {closureCard && (
          <ClosureCard
            at={closureCard}
            bounds={containerSize}
            saving={closureSaving}
            error={closureError}
            onSave={handleClosureSave}
            onCancel={handleClosureCancel}
          />
        )}

        {saveOpen && (
          <SavePanel
            mode={fiber ? 'edit' : 'create'}
            fiber={fiber}
            draftPoints={draft.points}
            coreCount={coreCount}
            onSaved={fiber ? handleDetailsSaved : handleCreated}
            onBack={() => setSaveOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
