'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { usePops } from '@/hooks/usePops'
import { useClosures } from '@/hooks/useClosures'
import { RATIO_LABELS } from '@/lib/fiber/constants'

/**
 * Snap targets for the fiber draw editor — POPs, closures and buildings,
 * merged into one flat list of `{ kind, id, label, latitude, longitude, splitter }`.
 * Fetches once per mount while `enabled`; `ready` flips once all three sources
 * have loaded (empty or not).
 */
export function useSnapTargets({ enabled }) {
  const { pops, loading: popsLoading } = usePops()
  const { closures, loading: closuresLoading } = useClosures()
  const [buildings, setBuildings] = useState([])
  const [buildingsLoading, setBuildingsLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!enabled || fetchedRef.current) return
    fetchedRef.current = true
    apiClient
      .get('/buildings/markers')
      .then((res) => {
        setBuildings(res.data.data)
        setBuildingsLoading(false)
      })
      .catch(() => setBuildingsLoading(false))
  }, [enabled])

  const targets = useMemo(
    () => [
      ...pops.map((p) => ({ kind: 'POP', id: p.id, label: p.name, latitude: p.latitude, longitude: p.longitude, splitter: null })),
      ...closures.map((c) => ({
        kind: 'CLOSURE',
        id: c.id,
        label: c.code,
        latitude: c.latitude,
        longitude: c.longitude,
        splitter: RATIO_LABELS[c.splitters?.[0]?.ratio] ?? null,
      })),
      ...buildings.map((b) => ({ kind: 'BUILDING', id: b.id, label: b.buildingName, latitude: b.latitude, longitude: b.longitude, splitter: null })),
    ],
    [pops, closures, buildings]
  )

  return { targets, ready: !popsLoading && !closuresLoading && !buildingsLoading }
}
