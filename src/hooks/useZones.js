'use client'

import { createSessionResource } from '@/lib/session-resource'

const useZonesResource = createSessionResource('/zones')

/** Zone list (role-scoped by the API), fetched once per session. */
export function useZones(enabled = true) {
  const { data, loading } = useZonesResource(enabled)
  return { zones: data, loading }
}

export const invalidateZones = () => useZonesResource.invalidate()
