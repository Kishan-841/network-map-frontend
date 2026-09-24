'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { createSessionResource } from '@/lib/session-resource'

// The actor's in-scope buildings (an executive's assigned list, or the pool a
// manager / team leader distributes). Role-scoped by the API.
const useSalesBuildingsResource = createSessionResource('/sales/buildings')

export function useSalesBuildings() {
  const { data, loading } = useSalesBuildingsResource()
  return { buildings: data ?? [], loading }
}

export const invalidateSalesBuildings = () => useSalesBuildingsResource.invalidate()

/**
 * The field user's current OPEN visit (or null). Not a session resource — it
 * flips on every check-in / activity / check-out, so it holds a single object
 * and re-fetches on `refresh()`.
 */
export function useOpenVisit(enabled = true) {
  const [visit, setVisit] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    setLoading(true)
    apiClient
      .get('/sales/visits/open')
      .then((res) => alive && (setVisit(res.data.data), setLoading(false)))
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [enabled, tick])

  return { visit, loading, refresh: () => setTick((t) => t + 1) }
}
