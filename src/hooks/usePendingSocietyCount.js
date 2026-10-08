'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'

export const SOCIETIES_HREF = '/societies'

// One request per page (route) and per invalidate, shared by the sidebar and
// the bottom bar, which are both mounted.
const shared = { key: null, promise: null }
let version = 0
const listeners = new Set()

/** Re-count after an approve / reject, or anything that sends one for approval. */
export function invalidatePendingSocietyCount() {
  version += 1
  listeners.forEach((notify) => notify())
}

/**
 * How many societies wait for the admin's approval — the badge on the
 * admin's "Society permissions" link. ADMIN only; 0 for everyone else and on
 * any error (a badge that cannot load is simply not shown).
 */
export function usePendingSocietyCount() {
  const user = useAuthStore((s) => s.user)
  const enabled = user?.role === 'ADMIN'
  const pathname = usePathname()
  const [count, setCount] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const notify = () => setTick((t) => t + 1)
    listeners.add(notify)
    return () => listeners.delete(notify)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    const key = `${user?.id}|${pathname}|${version}`
    if (shared.key !== key) {
      shared.key = key
      shared.promise = apiClient
        .get('/permission-buildings/pending-count')
        .then((res) => Number(res.data.data?.count) || 0)
    }
    let alive = true
    shared.promise.then(
      (n) => alive && setCount(n),
      () => alive && setCount(0),
    )
    return () => {
      alive = false
    }
  }, [enabled, user?.id, pathname, tick])

  return enabled ? count : 0
}
