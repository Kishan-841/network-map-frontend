'use client'

import { useCallback, useState } from 'react'
import { backEntry, openEntry, pushEntry } from '@/lib/fiber/detail-stack'

/** The drawer's history for one page: `open` starts afresh, `push` follows a link. */
export function useDetailStack() {
  const [stack, setStack] = useState([])
  const open = useCallback((kind, id) => setStack((s) => openEntry(s, { kind, id })), [])
  const push = useCallback((entry) => setStack((s) => pushEntry(s, entry)), [])
  const back = useCallback(() => setStack(backEntry), [])
  const close = useCallback(() => setStack([]), [])
  return { stack, current: stack.at(-1) ?? null, open, push, back, close }
}
