'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const TOAST_MS = 4000

const HINTS = {
  pan: 'Navigate to the area, then switch to Draw',
  draw: 'Tap to add a point · drag a point to move it',
  annotatePan: 'Tap a closure or splitter on the line to open it',
  addClosure: 'Tap on the line to place a closure',
  addSplitter: 'Tap on the line to place a splitter',
  editLine: 'Tap to extend the line · Save changes when done',
}

/** What this mode expects of the next tap. */
export const hintFor = (phase, mode) =>
  phase === 'annotate' && mode === 'pan' ? HINTS.annotatePan : HINTS[mode]

/**
 * One transient line of guidance at a time. The hook owns the timer (cleared
 * on unmount) and nothing ever sets state from an effect body — every toast
 * comes from a tap or from a callback the map hands back.
 */
export function useEditorToast(duration = TOAST_MS) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)
  const seqRef = useRef(0)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const show = useCallback(
    (text) => {
      if (!text) return
      if (timerRef.current) clearTimeout(timerRef.current)
      seqRef.current += 1
      setToast({ text, id: seqRef.current })
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setToast(null)
      }, duration)
    },
    [duration],
  )

  return [toast, show]
}
