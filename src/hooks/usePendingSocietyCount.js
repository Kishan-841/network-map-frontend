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

/** Re-count after an approve / reject (society or materials), or anything that sends one for a decision. */
export function invalidatePendingSocietyCount() {
  version += 1
  listeners.forEach((notify) => notify())
}

const ZERO = { approvals: 0, surveys: 0, total: 0 }
const count = (p) => p.then((res) => Number(res.data.data?.count) || 0).catch(() => 0)

/**
 * The admin's two to-dos on societies: how many wait for approval and how
 * many surveys (material requests) wait for a decision. ADMIN only; zeros for
 * everyone else and on any error (a badge that cannot load is simply not shown).
 */
export function usePendingSocietyCounts() {
  const user = useAuthStore((s) => s.user)
  const enabled = user?.role === 'ADMIN'
  const pathname = usePathname()
  const [counts, setCounts] = useState(ZERO)
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
      shared.promise = Promise.all([
        count(apiClient.get('/permission-buildings/pending-count')),
        count(apiClient.get('/permission-buildings/survey-pending-count')),
      ]).then(([approvals, surveys]) => ({ approvals, surveys, total: approvals + surveys }))
    }
    let alive = true
    shared.promise.then(
      (c) => alive && setCounts(c),
      () => alive && setCounts(ZERO),
    )
    return () => {
      alive = false
    }
  }, [enabled, user?.id, pathname, tick])

  return enabled ? counts : ZERO
}

/**
 * The one number on the admin's "Society permissions" nav link: societies
 * waiting for approval plus surveys waiting for a materials decision.
 */
export function usePendingSocietyCount() {
  return usePendingSocietyCounts().total
}
