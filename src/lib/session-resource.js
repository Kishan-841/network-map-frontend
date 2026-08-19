'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Session-cached GET hook factory. The FIRST component that mounts the hook
 * fetches; the result lives in module memory, so every later consumer — any
 * tab, any page, any reopen of a sheet — reuses it with zero network calls.
 * The cache dies with the JS session (hard refresh / new tab) or when the
 * logged-in user changes (logout, different login), never in between.
 *
 * Trade-off (deliberate): freshly created zones/operators/etc. won't appear
 * in dropdowns until a refresh. Reference data changes rarely; admin pages
 * that EDIT these lists keep their own always-fresh fetches.
 */
export function createSessionResource(path) {
  const cache = { userId: undefined, data: null, promise: null }

  return function useSessionResource(enabled = true) {
    const userId = useAuthStore((s) => s.user?.id)
    const cached = enabled && cache.userId === userId ? cache.data : null
    const [data, setData] = useState(cached)
    const [loading, setLoading] = useState(enabled && cached === null)

    useEffect(() => {
      if (!enabled || !userId) return
      // A different account invalidates the previous user's cache.
      if (cache.userId !== userId) {
        cache.userId = userId
        cache.data = null
        cache.promise = null
      }
      if (cache.data) return // state was seeded from cache — nothing to do
      cache.promise ??= apiClient.get(path).then((res) => {
        cache.data = res.data.data
        return cache.data
      })
      let cancelled = false
      cache.promise
        .then((result) => {
          if (!cancelled) {
            setData(result)
            setLoading(false)
          }
        })
        .catch(() => {
          cache.promise = null // allow a retry on the next mount
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }, [enabled, userId])

    return { data: data ?? [], loading }
  }
}
