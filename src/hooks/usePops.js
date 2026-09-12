'use client'

import { createSessionResource } from '@/lib/session-resource'

const usePopsResource = createSessionResource('/pops')

/** Every saved POP with its OLTs — shared by the map, the snap-target list and the admin table. */
export function usePops() {
  const { data, loading } = usePopsResource()
  return { pops: data, loading }
}

export const invalidatePops = () => usePopsResource.invalidate()
