'use client'
import { useEffect, useState } from 'react'

const LONG_PRESS_MS = 500,
  MOVE_TOLERANCE_PX = 8

/**
 * Right-click (desktop) and long-press (touch) gesture for opening the
 * per-point context menu on a draft polyline vertex. `hitTest(pixel)`
 * (nearest draft vertex within 12 px) is supplied by `useDraftPolyline`.
 */
export function usePointGesture({ containerRef, enabled, hitTest }) {
  const [menu, setMenu] = useState(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !enabled) return
    const pixelOf = (e) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const open = (pixel) => {
      const key = hitTest(pixel)
      if (key) setMenu({ pointKey: key, x: pixel.x, y: pixel.y })
    }
    const onContext = (e) => {
      e.preventDefault()
      open(pixelOf(e))
    }
    let timer = null,
      start = null
    const onDown = (e) => {
      if (e.pointerType === 'mouse') return
      start = pixelOf(e)
      timer = setTimeout(() => {
        open(start)
        timer = null
      }, LONG_PRESS_MS)
    }
    const cancel = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    const onMove = (e) => {
      if (timer && start && Math.hypot(pixelOf(e).x - start.x, pixelOf(e).y - start.y) > MOVE_TOLERANCE_PX) cancel()
    }
    el.addEventListener('contextmenu', onContext)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', cancel)
    el.addEventListener('pointercancel', cancel)
    return () => {
      cancel()
      el.removeEventListener('contextmenu', onContext)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', cancel)
      el.removeEventListener('pointercancel', cancel)
    }
  }, [containerRef, enabled, hitTest])
  return { menu, close: () => setMenu(null) }
}
