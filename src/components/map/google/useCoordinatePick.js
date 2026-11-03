'use client'
import { useEffect, useState } from 'react'

// Same feel as the fibre editor's point menu (usePointGesture).
const LONG_PRESS_MS = 500,
  MOVE_TOLERANCE_PX = 8,
  // The finger lifting after a long press can reach the map as a click —
  // that click must not close the card it just opened.
  RELEASE_GUARD_MS = 400

/**
 * "What's here?" on the buildings map: right-click (desktop) or press and hold
 * (touch) anywhere returns that spot's coordinates. On a Mac, a trackpad
 * two-finger click and Control + click arrive as the same `contextmenu` event.
 * A plain click / tap is left alone — it keeps selecting buildings and closing
 * wings.
 *
 * Returns `{ pick, close }`; `pick` is `{ latitude, longitude, x, y, width,
 * height }` (x/y and the map's size in px, for placing the card) or null.
 */
export function useCoordinatePick({ map, containerRef }) {
  const [pick, setPick] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    if (!map || !el) return

    // A blank overlay is the public way to reach the map's projection, which
    // turns a pixel inside the container into a lat/lng.
    const probe = new google.maps.OverlayView()
    probe.onAdd = () => {}
    probe.draw = () => {}
    probe.onRemove = () => {}
    probe.setMap(map)

    const pixelOf = (e) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const open = (pixel) => {
      const latLng = probe.getProjection()?.fromContainerPixelToLatLng(new google.maps.Point(pixel.x, pixel.y))
      if (!latLng) return
      setPick({
        latitude: latLng.lat(),
        longitude: latLng.lng(),
        x: pixel.x,
        y: pixel.y,
        width: el.clientWidth,
        height: el.clientHeight,
      })
    }

    const onContext = (e) => {
      e.preventDefault() // the browser's own menu has nothing useful here
      open(pixelOf(e))
    }

    let timer = null,
      start = null,
      fired = false,
      fingers = 0,
      guardUntil = 0
    const cancel = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    const onDown = (e) => {
      if (e.pointerType === 'mouse') return
      fingers += 1
      cancel()
      if (fingers > 1) return // a pinch-zoom, not a press
      start = pixelOf(e)
      fired = false
      timer = setTimeout(() => {
        timer = null
        fired = true
        navigator.vibrate?.(10) // a small buzz where supported: "got it"
        open(start)
      }, LONG_PRESS_MS)
    }
    const onMove = (e) => {
      if (!timer || !start) return
      const p = pixelOf(e)
      if (Math.hypot(p.x - start.x, p.y - start.y) > MOVE_TOLERANCE_PX) cancel() // a pan
    }
    const onUp = (e) => {
      if (e.pointerType === 'mouse') return
      fingers = Math.max(0, fingers - 1)
      cancel()
      if (fired) guardUntil = Date.now() + RELEASE_GUARD_MS
      fired = false
    }

    // Capture phase: the map's own handlers must not hide these from us.
    el.addEventListener('contextmenu', onContext, true)
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointermove', onMove, true)
    el.addEventListener('pointerup', onUp, true)
    el.addEventListener('pointercancel', onUp, true)

    const close = () => setPick(null)
    const listeners = [
      map.addListener('click', () => {
        if (Date.now() >= guardUntil) close()
      }),
      map.addListener('dragstart', close),
      map.addListener('zoom_changed', close),
    ]
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      cancel()
      el.removeEventListener('contextmenu', onContext, true)
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointermove', onMove, true)
      el.removeEventListener('pointerup', onUp, true)
      el.removeEventListener('pointercancel', onUp, true)
      listeners.forEach((l) => l.remove())
      window.removeEventListener('keydown', onKey)
      probe.setMap(null)
      setPick(null)
    }
  }, [map, containerRef])

  return { pick, close: () => setPick(null) }
}
