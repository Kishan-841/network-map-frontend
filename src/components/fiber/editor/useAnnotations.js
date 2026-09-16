'use client'

import { useCallback, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { invalidateClosures } from '@/hooks/useClosures'
import { invalidateFibers } from '@/hooks/useFibers'

/**
 * Everything that happens to a closure or a splitter ON the draft line: which
 * card is open, and the create / edit / remove calls behind it. Lifted out of
 * FiberEditor unchanged — the editor keeps the map, this keeps the paperwork.
 *
 * `patchPoints` and `reloadFiber` come from the editor (they close over the
 * saved fiber); `onOpenCard` lets it dismiss whatever else was on screen.
 */
export function useAnnotations({ draft, dispatch, patchPoints, reloadFiber, onOpenCard }) {
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

  const openPoint = useCallback(
    (point) => {
      onOpenCard?.()
      if (point.type === 'SPLITTER') {
        setSplitterError(null)
        setEditingClosure(null)
        setSplitterCard(point)
        return
      }
      setSplitterCard(null)
      setEditingClosure(point)
    },
    [onOpenCard],
  )

  /** A tap that hit the line in Add-closure / Add-splitter mode. */
  function dropOnLine(mode, hit, pixel) {
    const key = `p${draft.nextKey}`
    const closure = mode === 'addClosure'
    dispatch({
      type: 'insert',
      index: hit.index + 1,
      point: {
        latitude: hit.latitude,
        longitude: hit.longitude,
        pointType: closure ? 'CLOSURE' : 'SPLITTER',
        ref: closure ? { newClosure: { kind: null } } : { newSplitter: null },
      },
    })
    if (closure) {
      setClosureError(null)
      setClosureCard({ key, x: pixel.x, y: pixel.y })
      return
    }
    setSplitterError(null)
    setSplitterIsNew(true)
    setSplitterPoint({ key, latitude: hit.latitude, longitude: hit.longitude, type: 'SPLITTER', ref: null })
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
    const warning = point.ref.splitterId ? ` Its ${point.ref.splitter} splitter is deleted with it.` : ''
    if (
      !window.confirm(`Remove ${point.ref.code}? The point stays as a plain bend in the line.${warning}`)
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

  /** Switching mode drops whatever the previous mode had open. */
  function resetForMode(next) {
    if (splitterIsNew && splitterPoint) dispatch({ type: 'remove', key: splitterPoint.key })
    setSplitterPoint(null)
    setSplitterIsNew(false)
    setSplitterCard(null)
    setSplitterError(null)
    // Pan is where cards belong — only the drawing modes clear the open one.
    if (next !== 'pan') setEditingClosure(null)
  }

  return {
    editingClosure,
    closureCard,
    splitterCard,
    splitterPoint,
    closureSaving,
    closureError,
    splitterSaving,
    splitterError,
    anyCardOpen:
      closureCard !== null || editingClosure !== null || splitterPoint !== null || splitterCard !== null,
    openPoint,
    dropOnLine,
    openSplitterEditor: () => {
      setSplitterError(null)
      setSplitterIsNew(false)
      setSplitterPoint(splitterCard)
    },
    closeSplitterCard: () => {
      setSplitterCard(null)
      setSplitterError(null)
    },
    handleClosureSave,
    handleClosureCancel,
    handleClosureEditSave,
    handleClosureRemove,
    handleClosureSplitterRemove,
    handleSplitterSave,
    handleSplitterCardRemove,
    handleSplitterCancel,
    handleClosureEditCancel,
    resetForMode,
  }
}
