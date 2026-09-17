'use client'

import { createSessionResource } from '@/lib/session-resource'

const useFibersResource = createSessionResource('/fibers')

/** Every saved fiber with points/segments/totals — the map, the editor's context layer and the admin table share it. */
export function useFibers(enabled = true) {
  const { data, loading } = useFibersResource(enabled)
  return { fibers: data, loading }
}

export const invalidateFibers = () => useFibersResource.invalidate()
