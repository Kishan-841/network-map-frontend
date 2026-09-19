'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'

/**
 * Load one record for the drawer. The mount site keys each body by its id, so
 * this always starts fresh — state is only set from a settled request, never
 * synchronously in the effect body.
 */
export function useDetail(path, failMessage) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    apiClient
      .get(path)
      .then((res) => alive && setState({ data: res.data.data, loading: false, error: null }))
      .catch((err) => alive && setState({ data: null, loading: false, error: getApiErrorMessage(err, failMessage) }))
    return () => {
      alive = false
    }
  }, [path, failMessage, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const retry = useCallback(() => {
    setState({ data: null, loading: true, error: null })
    setVersion((v) => v + 1)
  }, [])

  return { ...state, refresh, retry }
}
