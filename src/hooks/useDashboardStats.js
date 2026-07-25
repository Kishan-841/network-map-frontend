'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

export function useDashboardStats() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiClient
      .get('/stats/dashboard')
      .then((res) => setStats(res.data.data))
      .catch(() => setError('Could not load dashboard stats'))
  }, [])

  return { stats, error }
}
