'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

/** Full city list for admin forms and filter dropdowns. */
export function useCities() {
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/cities')
      .then((res) => {
        if (!cancelled) setCities(res.data.data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { cities, loading }
}
