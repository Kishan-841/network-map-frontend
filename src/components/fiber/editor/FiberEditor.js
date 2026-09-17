'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useMapLayer } from '@/lib/useMapLayer'
import { emptyDraft, reduce, draftErrors, fromApiPoints, toPayloadPoints } from '@/lib/fiber/draft'
import { useFibers, invalidateFibers } from '@/hooks/useFibers'
import { invalidateClosures } from '@/hooks/useClosures'
import { IconLocate } from '@/components/ui/icons'
import { useFiberOverlays } from '../useFiberOverlays'
import { useDraftPolyline, pixelToLatLng } from './useDraftPolyline'
import { useSnapTargets } from './useSnapTargets'
import { useEditorOverlays, useOverlayToggles } from './useEditorOverlays'
import { useEditorMap, MAP_CHROME_CSS } from './useEditorMap'
import { useEditorToast, hintFor } from './useEditorToast'
import { useAnnotations } from './useAnnotations'
import EditorTopBar from './EditorTopBar'
import EditorBottomBar from './EditorBottomBar'
import EditorDrawer from './EditorDrawer'
import EditorSearchButton from './EditorSearchButton'
import EditorToast from './EditorToast'
import EditorCards from './EditorCards'

const MAX_POINTS = 200 // matches the API cap (fiber.schemas.js)
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

/**
 * Full-screen editor for ONE fiber, in two phases on the same map:
 *
 *  - `draw`     — a new line: tap points, then "Save fiber" writes it with the
 *                 short details form. The editor stays open.
 *  - `annotate` — a saved fiber: tap the line to drop a closure on it (the
 *                 API mints its JC- code), edit the line, or leave with Done.
 *
 * Editing an existing fiber lands straight in `annotate`.
 *
 * The chrome is mobile-first: a 48-px top bar, one mode bar under the thumb,
 * and everything occasional (core count, base layer, overlays, Clear) behind
 * the right-edge drawer — so the map keeps the screen.
 */
export default function FiberEditor({ initialFiber, onClose, onSaved }) {
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
  const [pointsError, setPointsError] = useState(null)
  const [savingPoints, setSavingPoints] = useState(false)
  const [toast, showToast] = useEditorToast()

  // Draw and Add-closure both take over the tap: the map's own gestures go
  // quiet so every tap reaches our handler.
  const drawing = mode === 'draw' || mode === 'editLine'
  const frozen = drawing || mode === 'addClosure' || mode === 'addSplitter'

  const { targets } = useSnapTargets({ enabled: true })
  // Fetched while the "Other fiber" overlay is on — and for a brand new line,
  // whose opening view falls back to the last fiber anyone drew.
  const { fibers } = useFibers(overlays.others || !initialFiber)

  const draftRef = useRef(draft)
  const { containerRef, map, ready, containerSize, panTo, getCenter, locate, locating } =
    useEditorMap({
      layer,
      frozen,
      existing: Boolean(initialFiber),
      fibers,
      draftRef,
      onReady: () => showToast(hintFor(initialFiber ? 'annotate' : 'draw', initialFiber ? 'pan' : 'draw')),
    })

  function applySaved(saved) {
    const points = fromApiPoints(saved.points)
    setFiber(saved)
    dispatch({ type: 'load', points })
    setSavedSignature(signatureOf(points))
    invalidateFibers()
    invalidateClosures()
    onSaved?.(saved)
  }

  async function patchPoints(points) {
    const res = await apiClient.patch(`/fibers/${fiber.id}`, { points: toPayloadPoints(points) })
    applySaved(res.data.data)
  }

  /** Re-reads the fiber so a point's splitter fields (and its marker) are current. */
  async function reloadFiber() {
    const res = await apiClient.get(`/fibers/${fiber.id}`)
    applySaved(res.data.data)
  }

  const clearTarget = useCallback(() => setSelectedTarget(null), [])
  const annotations = useAnnotations({
    draft,
    dispatch,
    patchPoints,
    reloadFiber,
    onOpenCard: clearTarget,
  })

  // Mirrors for the DOM listener, which is attached once.
  const modeRef = useRef(mode)
  const cardOpenRef = useRef(false)
  const toastRef = useRef(showToast)
  const annotationsRef = useRef(annotations)
  useEffect(() => {
    draftRef.current = draft
    modeRef.current = mode
    cardOpenRef.current = annotations.anyCardOpen
    toastRef.current = showToast
    annotationsRef.current = annotations
  })

  // A tap can only ever mean "show me what this is" once the fiber is saved
  // and the map isn't owning taps for drawing — never in Draw / Add closure /
  // Add splitter / Edit line, where a tap must reach the map instead.
  const pointsClickable = phase === 'annotate' && mode === 'pan'

  const { hitTestLine, projection } = useDraftPolyline({
    map,
    ready,
    draft,
    dispatch,
    drawing,
    coreCount,
    snapRing: null,
    pointsClickable,
    onClosureClick: annotations.openPoint,
  })

  const handleTargetClick = useCallback((target) => {
    if (modeRef.current === 'pan') setSelectedTarget(target)
  }, [])
  // Closures and splitters the DRAFT already draws: the context layer must skip
  // them, or every one is painted twice with two badges fighting over the spot.
  const draftEntityIds = useMemo(() => {
    const ids = new Set()
    for (const point of draft.points) {
      if (point.ref?.closureId) ids.add(point.ref.closureId)
      if (point.ref?.splitterId) ids.add(point.ref.splitterId)
    }
    return ids
  }, [draft.points])
  useEditorOverlays({
    map,
    ready,
    targets,
    buildingsShown: overlays.buildings,
    zonesShown: overlays.zones,
    onTargetClick: handleTargetClick,
    // Drawing / dropping a closure: markers must not intercept the tap.
    markersClickable: !frozen,
    excludeIds: draftEntityIds,
  })

  // Saved fibers as dim context behind the draft — never interactive here.
  // `fibers` is a fresh [] on every render until the fetch lands — map that
  // window onto the stable empty array so the overlay does not rebuild.
  const otherFibers = overlays.others && fibers.length > 0 ? fibers : NO_FIBERS
  useFiberOverlays({ map, ready, fibers: otherFibers, exclude: fiber?.id, dim: true, cluster: false })

  // ---- map taps on the container (never the map's own click event) ----------
  useEffect(() => {
    const container = containerRef.current
    if (!container || !ready) return

    const onClick = (event) => {
      if (cardOpenRef.current || !isMapSurface(event)) return
      const rect = container.getBoundingClientRect()
      const pixel = { x: event.clientX - rect.left, y: event.clientY - rect.top }

      if (modeRef.current === 'addClosure' || modeRef.current === 'addSplitter') {
        const hit = hitTestLine(pixel)
        if (!hit) {
          toastRef.current?.('Click on the line')
          return
        }
        annotationsRef.current.dropOnLine(modeRef.current, hit, pixel)
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
  }, [ready, projection, hitTestLine, containerRef])

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

  // ---- actions --------------------------------------------------------------
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

  function handleLeave() {
    if (dirty && !window.confirm('The line has unsaved changes. Close anyway?')) return
    onClose()
  }

  function handleMode(next) {
    setMode(next)
    annotations.resetForMode(next)
    if (next !== 'pan') setSelectedTarget(null) // stale cards are noise while drawing
    showToast(hintFor(phase, next))
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
      {/* Dark halo keeps map labels readable on roadmap AND imagery. */}
      <style>{MAP_CHROME_CSS}</style>

      <EditorTopBar
        phase={phase}
        title={fiber?.name?.trim() || 'New fiber'}
        counts={counts}
        canSave={errors.length === 0}
        dirty={dirty}
        savingPoints={savingPoints}
        showUndo={drawing}
        canUndo={counts.points > 0}
        onUndo={() => dispatch({ type: 'undo' })}
        onLeave={handleLeave}
        onSave={phase === 'draw' ? () => setSaveOpen(true) : handleSaveChanges}
      />

      <div className="relative min-h-0 flex-1">
        {/* touch-action while a mode owns the tap: the default `auto` holds a
            tap back to see whether a double-tap-to-zoom is coming and never
            synthesises the click, so on a phone the first tap is lost and
            every later one lands a point behind. */}
        <div
          ref={containerRef}
          className="fiber-editor-map h-full w-full"
          style={frozen ? { touchAction: 'none' } : undefined}
        />

        <EditorSearchButton getCenter={getCenter} onJump={panTo} />

        <button
          type="button"
          onClick={() => locate(showToast)}
          aria-label="Centre on my location"
          className="absolute bottom-[10.5rem] right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted shadow-lift transition-colors hover:text-ink lg:bottom-28"
        >
          {locating ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <IconLocate className="h-5 w-5" aria-hidden="true" />
          )}
        </button>

        <EditorDrawer
          coreCount={coreCount}
          onCoreCount={setCoreCount}
          layer={layer}
          onLayer={setLayer}
          overlays={overlays}
          onToggleOverlay={(key, value) => {
            toggleOverlay(key, value)
            if (key === 'buildings' && !value) setSelectedTarget(null)
          }}
          onClear={() => dispatch({ type: 'clear' })}
          canClear={phase === 'draw' && counts.points > 0}
          onDetails={phase === 'annotate' ? () => setSaveOpen(true) : null}
          onHelp={() => showToast(hintFor(phase, mode))}
        />

        <EditorToast toast={toast} />

        {/* Under two points the only error is the length rule, which the
            disabled Save button already says — keep the banner for real ones. */}
        {((counts.points >= 2 && errors.length > 0) || pointsError) && (
          <div className="absolute inset-x-3 top-[4.5rem] z-10 mx-auto max-w-md rounded-card border border-line bg-card px-4 py-3 text-sm font-normal text-bad shadow-lift">
            {counts.points >= 2 && errors.map((error) => <p key={error}>{error}</p>)}
            {pointsError && <p>{pointsError}</p>}
          </div>
        )}

        <EditorCards
          annotations={annotations}
          containerSize={containerSize}
          selectedTarget={selectedTarget}
          onCloseTarget={clearTarget}
          saveOpen={saveOpen}
          fiber={fiber}
          draftPoints={draft.points}
          coreCount={coreCount}
          onSaved={fiber ? handleDetailsSaved : handleCreated}
          onSaveBack={() => setSaveOpen(false)}
        />

        <EditorBottomBar phase={phase} mode={mode} onMode={handleMode} coreCount={coreCount} />
      </div>
    </div>
  )
}
