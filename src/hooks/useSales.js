'use client'

import { createSessionResource } from '@/lib/session-resource'

// The actor's in-scope buildings (an executive's assigned list, or the pool a
// manager / team leader distributes). Role-scoped by the API.
const useSalesBuildingsResource = createSessionResource('/sales/buildings')

export function useSalesBuildings() {
  const { data, loading } = useSalesBuildingsResource()
  return { buildings: data ?? [], loading }
}

export const invalidateSalesBuildings = () => useSalesBuildingsResource.invalidate()
