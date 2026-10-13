'use client'

import { useMemo } from 'react'
import { usePops } from '@/hooks/usePops'
import { useClosures } from '@/hooks/useClosures'
import { useBuildingMarkers } from '@/hooks/useBuildingMarkers'
import { RATIO_LABELS } from '@/lib/fiber/constants'

const NONE = []

/**
 * Snap targets for the fiber draw editor — POPs, closures and buildings, each
 * `{ kind, id, label, latitude, longitude, splitter }`.
 *
 * Buildings come from the session cache the map already filled (no second
 * download of every building), and are returned on their own as
 * `buildingTargets`: saving a closure refetches closures, and that must not
 * hand the building layer a new array — it would redraw every building dot.
 * `ready` flips once all three sources have loaded (empty or not).
 */
export function useSnapTargets() {
  const { pops, loading: popsLoading } = usePops()
  const { closures, loading: closuresLoading } = useClosures()
  const { markers, loading: buildingsLoading } = useBuildingMarkers()
  const buildings = markers ?? NONE

  const nodeTargets = useMemo(
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
    ],
    [pops, closures],
  )
  const buildingTargets = useMemo(
    () => buildings.map((b) => ({ kind: 'BUILDING', id: b.id, label: b.buildingName, latitude: b.latitude, longitude: b.longitude, splitter: null })),
    [buildings],
  )
  const targets = useMemo(() => [...nodeTargets, ...buildingTargets], [nodeTargets, buildingTargets])

  return { targets, nodeTargets, buildingTargets, ready: !popsLoading && !closuresLoading && !buildingsLoading }
}
