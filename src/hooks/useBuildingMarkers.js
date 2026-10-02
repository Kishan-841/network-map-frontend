'use client'

import { createSessionResource } from '@/lib/session-resource'

const useBuildingMarkersResource = createSessionResource('/buildings/markers')

/**
 * Every building the signed-in user may see, as map markers.
 *
 * One request per session instead of one per filter change: the endpoint is
 * unpaginated and role-scoped, so the whole set arrives once and filtering
 * happens in the browser (see `@/lib/building-filters`). That is what lets
 * the map draw all 1155 buildings — it used to read the paginated list at
 * pageSize=500 and silently drop the rest.
 *
 * Staleness is handled by invalidation, not a TTL: every building mutation
 * calls `invalidateBuildingMarkers()`.
 */
export function useBuildingMarkers() {
  const { data, loading } = useBuildingMarkersResource()
  return { markers: data, loading }
}

export const invalidateBuildingMarkers = () => useBuildingMarkersResource.invalidate()
