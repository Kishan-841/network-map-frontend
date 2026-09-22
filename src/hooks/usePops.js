'use client'

import { createSessionResource } from '@/lib/session-resource'

const usePopsResource = createSessionResource('/pops')

/** Every saved POP with its OLTs — shared by the map, the snap-target list and the admin table. */
export function usePops(enabled = true) {
  const { data, loading } = usePopsResource(enabled)
  return { pops: data, loading }
}

export const invalidatePops = () => usePopsResource.invalidate()
