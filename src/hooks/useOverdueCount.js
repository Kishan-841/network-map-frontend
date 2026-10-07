'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { receivesVisitTasks } from '@/lib/roles'

export const OVERDUE_HREF = '/sales/overdue'

// One request per page (route) and per invalidate, shared by every nav that
// shows the badge — the sidebar and the bottom bar are both mounted.
const shared = { key: null, promise: null }
let version = 0
const listeners = new Set()

/** Re-count after something that can change it (a check-in, a check-out). */
export function invalidateOverdueCount() {
  version += 1
  listeners.forEach((notify) => notify())
}

/**
 * How many visit-plan tasks the signed-in person missed in the last 30 days,
 * for the red badge on the Overdue tab. Only for people given tasks
 * (executives, team leaders); 0 for everyone else and on any error — a badge
 * that cannot load is simply not shown.
 */
export function useOverdueCount() {
  const user = useAuthStore((s) => s.user)
  const enabled = receivesVisitTasks(user?.role)
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
      shared.promise = apiClient.get('/sales/tasks/overdue').then((res) => res.data.data.length)
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
