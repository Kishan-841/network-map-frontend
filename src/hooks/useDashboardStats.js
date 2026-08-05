'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

/** Dashboard stats, refetched when the operator filter changes. */
export function useDashboardStats(operatorId = '') {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const params = operatorId ? { operatorId } : {}
    apiClient
      .get('/stats/dashboard', { params })
      .then((res) => !cancelled && setStats(res.data.data))
      .catch(() => !cancelled && setError('Could not load dashboard stats'))
    return () => {
      cancelled = true
    }
  }, [operatorId])

  return { stats, error }
}
