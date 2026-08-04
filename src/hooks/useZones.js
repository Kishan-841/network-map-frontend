'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

export function useZones() {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/zones')
      .then((res) => {
        if (!cancelled) setZones(res.data.data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { zones, loading }
}
