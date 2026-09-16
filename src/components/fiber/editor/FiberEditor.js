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
import SplitterCard from './SplitterCard'
import SplitterModal from './SplitterModal'
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
          p.ref?.closureId ??
          p.ref?.popId ??
          p.ref?.buildingId ??
          p.ref?.splitterId ??
          (p.ref?.newClosure || p.ref?.newSplitter ? 'new' : '')
        }`,
    )
    .join('|')

const HINTS = {
  pan: 'Navigate to the area, then switch to Draw points',
  draw: 'Tap to add a point · drag a point to move it',
  annotatePan: 'Tap a closure or splitter on the line to open it',
  addClosure: 'Click on the line to place a closure',
  addSplitter: 'Click on the line to place a splitter',
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
  const [editingClosure, setEditingClosure] = useState(null) // draft closure tapped in annotate + Pan
  const [closureCard, setClosureCard] = useState(null) // { key, x, y }
  const [splitterCard, setSplitterCard] = useState(null) // saved SPLITTER point tapped in Pan mode
  const [splitterPoint, setSplitterPoint] = useState(null) // point whose splitter modal is open
  // A splitter modal opened for a point that is not on the line yet: Cancel
  // takes the point back off instead of just closing.
  const [splitterIsNew, setSplitterIsNew] = useState(false)
  const [splitterSaving, setSplitterSaving] = useState(false)
  const [splitterError, setSplitterError] = useState(null)
  const [closureSaving, setClosureSaving] = useState(false)
  const [closureError, setClosureError] = useState(null)
  const [pointsError, setPointsError] = useState(null)
  const [savingPoints, setSavingPoints] = useState(false)
  const [missAt, setMissAt] = useState(0) // a click that found no line

  // Draw and Add-closure both take over the tap: the map's own gestures go
  // quiet so every tap reaches our handler.
  const drawing = mode === 'draw' || mode === 'editLine'
  const frozen = drawing || mode === 'addClosure' || mode === 'addSplitter'

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
    cardOpenRef.current =
      closureCard !== null || editingClosure !== null || splitterPoint !== null || splitterCard !== null
  })

  // A tap can only ever mean "show me what this is" once the fiber is saved
  // and the map isn't owning taps for drawing — never in Draw / Add closure /
  // Add splitter / Edit line, where a tap must reach the map instead.
  const pointsClickable = phase === 'annotate' && mode === 'pan'

  const handleClosureClick = useCallback((point) => {
    setSelectedTarget(null)
    if (point.type === 'SPLITTER') {
      setSplitterError(null)
      setEditingClosure(null)
      setSplitterCard(point)
      return
    }
    setSplitterCard(null)
    setEditingClosure(point)
  }, [])

  const { hitTestLine, projection } = useDraftPolyline({
    map,
    ready,
    draft,
    dispatch,
    drawing,
    coreCount,
    snapRing: null,
    pointsClickable,
    onClosureClick: handleClosureClick,
  })

  const handleTargetClick = useCallback((target) => {
    if (modeRef.current === 'pan') {
      setSelectedTarget(target)
      setEditingClosure(null)
    }
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

      if (modeRef.current === 'addSplitter') {
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
            pointType: 'SPLITTER',
            ref: { newSplitter: null },
          },
        })
        setSplitterError(null)
        setSplitterIsNew(true)
        setSplitterPoint({ key, latitude: hit.latitude, longitude: hit.longitude, type: 'SPLITTER', ref: null })
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
      splitters: draft.points.filter((p) => p.type === 'SPLITTER' || p.ref?.splitterId).length,
    }),
    [draft.points],
  )

  const errors = useMemo(() => draftErrors(draft.points), [draft.points])

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

  async function handleClosureEditSave({ kind, notes }) {
    const point = editingClosure
    setClosureSaving(true)
    setClosureError(null)
    try {
      await apiClient.patch(`/closures/${point.ref.closureId}`, { kind, notes })
      // Simpler than a round-trip GET /fibers/:id — only the ref changed, and
      // any other view of this fiber refetches once invalidated below.
      dispatch({ type: 'setType', key: point.key, pointType: 'CLOSURE', ref: { ...point.ref, kind, notes } })
      invalidateClosures()
      invalidateFibers()
      setEditingClosure(null)
    } catch (err) {
      setClosureError(getApiErrorMessage(err))
    } finally {
      setClosureSaving(false)
    }
  }

  async function handleClosureRemove() {
    const point = editingClosure
    const warning = point.ref.splitterId
      ? ` Its ${point.ref.splitter} splitter is deleted with it.`
      : ''
    if (
      !window.confirm(
        `Remove ${point.ref.code}? The point stays as a plain bend in the line.${warning}`,
      )
    )
      return
    setClosureSaving(true)
    setClosureError(null)
    try {
      // The point must stop referencing the closure BEFORE it is deleted —
      // the API 409s a delete while any fiber point still points at it.
      const points = draft.points.map((p) => (p.key === point.key ? { ...p, type: 'WAYPOINT', ref: null } : p))
      await patchPoints(points)
      await apiClient.delete(`/closures/${point.ref.closureId}`)
      invalidateClosures()
      setEditingClosure(null)
    } catch (err) {
      setClosureError(getApiErrorMessage(err))
    } finally {
      setClosureSaving(false)
    }
  }

  /** Re-reads the fiber so a point's splitter fields (and its marker) are current. */
  async function reloadFiber() {
    const res = await apiClient.get(`/fibers/${fiber.id}`)
    applySaved(res.data.data)
  }

  async function handleSplitterSave(values) {
    const point = splitterPoint
    setSplitterSaving(true)
    setSplitterError(null)
    try {
      if (point.ref?.splitterId) {
        // A saved splitter is its own record — edit it in place.
        await apiClient.patch(`/splitters/${point.ref.splitterId}`, values)
        await reloadFiber()
      } else {
        // A brand new one is minted by the same PATCH that puts the point on
        // the line, so the API hands back its S-code in one round trip.
        const ref = { newSplitter: values }
        const points = draft.points.map((p) => (p.key === point.key ? { ...p, type: 'SPLITTER', ref } : p))
        dispatch({ type: 'setType', key: point.key, pointType: 'SPLITTER', ref })
        await patchPoints(points)
      }
      setSplitterPoint(null)
      setSplitterIsNew(false)
      setSplitterCard(null)
      setEditingClosure(null)
    } catch (err) {
      setSplitterError(getApiErrorMessage(err))
    } finally {
      setSplitterSaving(false)
    }
  }

  /** Takes a splitter off the line: the point becomes a plain bend, then it goes. */
  async function removeSplitterAt(point, { retype }) {
    setSplitterSaving(true)
    setSplitterError(null)
    try {
      if (retype) {
        // The point must stop referencing the splitter BEFORE it is deleted —
        // the API 409s a delete while any fiber point still points at it.
        const points = draft.points.map((p) => (p.key === point.key ? { ...p, type: 'WAYPOINT', ref: null } : p))
        await patchPoints(points)
      }
      await apiClient.delete(`/splitters/${point.ref.splitterId}`)
      if (!retype) await reloadFiber()
      setSplitterPoint(null)
      setSplitterIsNew(false)
      setSplitterCard(null)
      setEditingClosure(null)
    } catch (err) {
      setSplitterError(getApiErrorMessage(err))
    } finally {
      setSplitterSaving(false)
    }
  }

  function handleSplitterCardRemove() {
    const point = splitterCard
    if (!window.confirm(`Remove ${point.ref.code}? The point stays as a plain bend.`)) return
    return removeSplitterAt(point, { retype: true })
  }

  /** The legacy shape: a splitter attached to a closure, deleted where it lives. */
  function handleClosureSplitterRemove() {
    const point = editingClosure
    const label = point.ref.splitter ?? 'splitter'
    if (!window.confirm(`Remove the ${label} splitter on ${point.ref.code}?`)) return
    return removeSplitterAt(point, { retype: false })
  }

  function handleSplitterCancel() {
    // A splitter that was never saved leaves no point behind.
    if (splitterIsNew) dispatch({ type: 'remove', key: splitterPoint.key })
    setSplitterPoint(null)
    setSplitterIsNew(false)
    setSplitterError(null)
  }

  function handleClosureEditCancel() {
    setEditingClosure(null)
    setClosureError(null)
  }

  function handleDone() {
    if (dirty && !window.confirm('The line has unsaved changes. Close anyway?')) return
    onClose()
  }

  function handleMode(next) {
    setMode(next)
    if (splitterIsNew && splitterPoint) dispatch({ type: 'remove', key: splitterPoint.key })
    setSplitterPoint(null)
    setSplitterIsNew(false)
    setSplitterCard(null)
    setSplitterError(null)
    if (next !== 'pan') {
      // Stale cards are noise while drawing.
      setSelectedTarget(null)
      setEditingClosure(null)
    }
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

        {/* Tapped closure ON the draft line itself (annotate + Pan mode):
            edit its type/note or remove it from the line entirely. */}
        {editingClosure && (
          <ClosureCard
            key={editingClosure.key}
            mode="edit"
            initial={{
              code: editingClosure.ref?.code,
              kind: editingClosure.ref?.kind,
              notes: editingClosure.ref?.notes,
            }}
            splitter={
              editingClosure.ref?.splitterId
                ? {
                    ratio: editingClosure.ref.splitterRatio,
                    fiberType: editingClosure.ref.splitterFiberType,
                    location: editingClosure.ref.splitterLocation,
                  }
                : null
            }
            onRemoveSplitter={handleClosureSplitterRemove}
            saving={closureSaving || splitterSaving}
            error={closureError ?? splitterError}
            onSave={handleClosureEditSave}
            onRemove={handleClosureRemove}
            onCancel={handleClosureEditCancel}
          />
        )}

        {closureCard && (
          <ClosureCard
            key={closureCard.key}
            mode="create"
            at={closureCard}
            bounds={containerSize}
            saving={closureSaving}
            error={closureError}
            onSave={handleClosureSave}
            onCancel={handleClosureCancel}
          />
        )}

        {/* A saved splitter tapped on the line: what it is, Edit, Remove. */}
        {splitterCard && (
          <SplitterCard
            key={`splitter-card-${splitterCard.key}`}
            point={splitterCard}
            saving={splitterSaving}
            error={splitterError}
            onEdit={() => {
              setSplitterError(null)
              setSplitterIsNew(false)
              setSplitterPoint(splitterCard)
            }}
            onRemove={handleSplitterCardRemove}
            onCancel={() => {
              setSplitterCard(null)
              setSplitterError(null)
            }}
          />
        )}

        {splitterPoint && (
          <SplitterModal
            // Prefixed: the card behind it is keyed on the same point.
            key={`splitter-${splitterPoint.key}`}
            code={splitterPoint.ref?.code}
            initial={
              splitterPoint.ref?.splitterId
                ? {
                    ratio: splitterPoint.ref.splitterRatio,
                    fiberType: splitterPoint.ref.splitterFiberType,
                    location: splitterPoint.ref.splitterLocation,
                  }
                : null
            }
            saving={splitterSaving}
            error={splitterError}
            onSave={handleSplitterSave}
            onCancel={handleSplitterCancel}
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
