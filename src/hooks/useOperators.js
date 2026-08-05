'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

/** Full operator list (legacy array shape) for filter dropdowns. */
export function useOperators() {
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/operators')
      .then((res) => {
        if (!cancelled) setOperators(res.data.data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { operators, loading }
}
